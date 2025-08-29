from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import asyncio
import aiohttp
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command, CommandStart
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web
import openai

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Telegram Bot Setup
BOT_TOKEN = os.environ.get('BOT_TOKEN')
WEBHOOK_PATH = "/webhook/telegram"
WEBAPP_URL = os.environ.get('WEBAPP_URL', 'https://stargazer-12.preview.emergentagent.com')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

# Initialize OpenAI client
openai.api_key = OPENAI_API_KEY

# Initialize bot and dispatcher
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    birth_date: Optional[str] = None
    birth_time: Optional[str] = None
    birth_place: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class BirthData(BaseModel):
    birth_date: str
    birth_time: str
    birth_place: str

class AstrologyReading(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    telegram_id: int
    question: str
    reading: str
    birth_data: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Helper Functions
async def get_or_create_user(telegram_user: types.User) -> User:
    """Get existing user or create new one"""
    user_doc = await db.users.find_one({"telegram_id": telegram_user.id})
    
    if user_doc:
        return User(**user_doc)
    
    # Create new user
    user = User(
        telegram_id=telegram_user.id,
        username=telegram_user.username,
        first_name=telegram_user.first_name,
        last_name=telegram_user.last_name
    )
    
    await db.users.insert_one(user.dict())
    return user

async def update_birth_data(telegram_id: int, birth_data: BirthData):
    """Update user's birth data"""
    await db.users.update_one(
        {"telegram_id": telegram_id},
        {"$set": {
            "birth_date": birth_data.birth_date,
            "birth_time": birth_data.birth_time,
            "birth_place": birth_data.birth_place
        }}
    )

async def generate_astrology_reading(user_data: dict, question: str = "Give me a general astrology reading") -> str:
    """Generate AI-powered astrology reading using OpenAI"""
    try:
        # Create a comprehensive prompt for astrology reading
        birth_info = ""
        if user_data.get('birth_date') and user_data.get('birth_time') and user_data.get('birth_place'):
            birth_info = f"""
Birth Date: {user_data['birth_date']}
Birth Time: {user_data['birth_time']}
Birth Place: {user_data['birth_place']}
"""
        else:
            birth_info = "Birth data not provided yet."

        prompt = f"""You are StarWeaver, a wise and compassionate astrologer who provides personalized readings for women. 
You combine ancient astrological wisdom with modern psychological insights.

User Information:
Name: {user_data.get('first_name', 'Dear soul')}
{birth_info}

User's Question: {question}

Provide a warm, insightful astrology reading that:
1. Addresses their specific question with empathy and wisdom
2. Incorporates relevant astrological concepts if birth data is available
3. Offers practical guidance and encouragement
4. Uses a supportive, feminine-empowering tone
5. Keeps the reading between 150-300 words

If no birth data is provided, focus on general guidance and encourage them to share their birth information for more personalized readings.
"""

        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.7
        )
        
        return response.choices[0].message.content.strip()
    
    except Exception as e:
        logger.error(f"Error generating astrology reading: {e}")
        return "I'm having trouble connecting to the cosmic energies right now. Please try again in a moment. ✨"

# Telegram Bot Handlers
@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    """Handle /start command"""
    user = await get_or_create_user(message.from_user)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🌟 Open StarWeaver App", 
            web_app=WebAppInfo(url=WEBAPP_URL)
        )],
        [InlineKeyboardButton(text="✨ Get Reading", callback_data="get_reading")],
        [InlineKeyboardButton(text="🎂 Set Birth Data", callback_data="set_birth_data")]
    ])
    
    welcome_text = f"""🌟 Welcome to StarWeaver, {user.first_name or 'beautiful soul'}! 

I'm your personal AI astrologer, here to provide you with cosmic guidance and insights. 

✨ What I can do for you:
• Personalized astrology readings
• Daily cosmic guidance  
• Answer your questions about love, career, and life
• Connect you with the wisdom of the stars

To get started, you can:
🎂 Set your birth data for personalized readings
✨ Ask me any question for general guidance
🌟 Open the web app for full features

What would you like to explore first?"""

    await message.answer(welcome_text, reply_markup=keyboard)

@dp.callback_query(lambda query: query.data == "get_reading")
async def process_get_reading(callback_query: types.CallbackQuery):
    """Handle get reading callback"""
    await callback_query.answer()
    
    user_doc = await db.users.find_one({"telegram_id": callback_query.from_user.id})
    
    # Generate reading
    reading = await generate_astrology_reading(user_doc or {})
    
    # Save reading to database
    reading_obj = AstrologyReading(
        user_id=user_doc.get('id') if user_doc else str(uuid.uuid4()),
        telegram_id=callback_query.from_user.id,
        question="General reading requested via bot",
        reading=reading,
        birth_data=user_doc if user_doc else None
    )
    
    await db.readings.insert_one(reading_obj.dict())
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌟 Open Web App", web_app=WebAppInfo(url=WEBAPP_URL))],
        [InlineKeyboardButton(text="✨ Another Reading", callback_data="get_reading")]
    ])
    
    await callback_query.message.answer(f"🌟 *Your StarWeaver Reading* ✨\n\n{reading}", 
                                       parse_mode="Markdown", reply_markup=keyboard)

@dp.callback_query(lambda c: c.data == "set_birth_data")
async def process_set_birth_data(callback_query: types.CallbackQuery):
    """Handle set birth data callback"""
    await callback_query.answer()
    
    instructions = """🎂 *Set Your Birth Data* 

To give you the most accurate and personalized readings, I need your birth information.

Please send me your details in this format:
`YYYY-MM-DD HH:MM City, Country`

Example:
`1990-05-15 14:30 New York, USA`

This will help me calculate your natal chart and provide deeply personalized cosmic insights! ✨"""

    await callback_query.message.answer(instructions, parse_mode="Markdown")

@dp.message()
async def handle_messages(message: types.Message):
    """Handle all other messages"""
    text = message.text.strip()
    
    # Check if it's birth data format
    if len(text.split()) >= 3 and any(char.isdigit() for char in text):
        try:
            parts = text.split(' ', 2)
            if len(parts) >= 3:
                date_part = parts[0]
                time_part = parts[1]
                place_part = parts[2]
                
                # Simple validation
                if '-' in date_part and ':' in time_part:
                    birth_data = BirthData(
                        birth_date=date_part,
                        birth_time=time_part,
                        birth_place=place_part
                    )
                    
                    await update_birth_data(message.from_user.id, birth_data)
                    
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="✨ Get Personalized Reading", callback_data="get_reading")],
                        [InlineKeyboardButton(text="🌟 Open Web App", web_app=WebAppInfo(url=WEBAPP_URL))]
                    ])
                    
                    await message.answer(
                        f"🎂 Perfect! I've saved your birth data:\n"
                        f"📅 Date: {date_part}\n"
                        f"⏰ Time: {time_part}\n"
                        f"📍 Place: {place_part}\n\n"
                        f"Now I can give you deeply personalized readings! ✨",
                        reply_markup=keyboard
                    )
                    return
        except Exception as e:
            logger.error(f"Error processing birth data: {e}")
    
    # Treat as question for astrology reading
    user_doc = await db.users.find_one({"telegram_id": message.from_user.id})
    if not user_doc:
        user_doc = {}
    
    # Generate personalized reading
    reading = await generate_astrology_reading(user_doc, text)
    
    # Save reading
    reading_obj = AstrologyReading(
        user_id=user_doc.get('id', str(uuid.uuid4())),
        telegram_id=message.from_user.id,
        question=text,
        reading=reading,
        birth_data=user_doc
    )
    
    await db.readings.insert_one(reading_obj.dict())
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌟 Open Web App", web_app=WebAppInfo(url=WEBAPP_URL))],
        [InlineKeyboardButton(text="✨ Ask Another Question", callback_data="get_reading")]
    ])
    
    await message.answer(f"✨ *Your Personalized Reading* 🌟\n\n{reading}", 
                        parse_mode="Markdown", reply_markup=keyboard)

# API Routes
@api_router.get("/")
async def root():
    return {"message": "StarWeaver API - Your cosmic guidance awaits ✨"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

@api_router.get("/user/{telegram_id}")
async def get_user_profile(telegram_id: int):
    """Get user profile by telegram ID"""
    user_doc = await db.users.find_one({"telegram_id": telegram_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user_doc)

@api_router.get("/readings/{telegram_id}")
async def get_user_readings(telegram_id: int):
    """Get all readings for a user"""
    readings = await db.readings.find({"telegram_id": telegram_id}).sort("created_at", -1).to_list(100)
    return [AstrologyReading(**reading) for reading in readings]

@api_router.post("/webhook/telegram")
async def telegram_webhook(request: Request):
    """Handle Telegram webhook"""
    try:
        json_data = await request.json()
        update = types.Update(**json_data)
        
        # Log incoming update for debugging
        logger.info(f"Received update: {update.update_id} from user {update.message.from_user.id if update.message else 'unknown'}")
        
        await dp.feed_update(bot, update)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"ok": False}

# Include the router in the main app
app.include_router(api_router)

# Add Telegram webhook endpoint to main app
@app.post("/webhook/telegram")
async def telegram_webhook_main(request: Request):
    return await telegram_webhook(request)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Set webhook on startup"""
    try:
        webhook_url = f"{os.environ.get('REACT_APP_BACKEND_URL', WEBAPP_URL)}/webhook/telegram"
        # Delete existing webhook first
        await bot.delete_webhook()
        # Set new webhook
        await bot.set_webhook(webhook_url)
        logger.info(f"Webhook set to: {webhook_url}")
        
        # Test bot connection
        me = await bot.get_me()
        logger.info(f"Bot connected: @{me.username} (ID: {me.id})")
    except Exception as e:
        logger.error(f"Failed to set webhook: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    await bot.session.close()