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
from datetime import datetime, timezone, timedelta
import asyncio
import aiohttp
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, CommandStart
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton, LabeledPrice
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
    subscription_active: bool = False
    subscription_end: Optional[datetime] = None
    free_readings_left: int = 3
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

# Subscription constants
SUBSCRIPTION_PRICE = 100  # Telegram Stars
SUBSCRIPTION_TITLE = "Премиум подписка LunaAura"
SUBSCRIPTION_DESCRIPTION = "Безлимитные астрологические чтения на месяц ✨"

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
        last_name=telegram_user.last_name,
        free_readings_left=3
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

async def can_get_reading(user_data: dict) -> bool:
    """Check if user can get a reading"""
    # Check if has active subscription
    if user_data.get('subscription_active') and user_data.get('subscription_end'):
        subscription_end = user_data['subscription_end']
        if isinstance(subscription_end, str):
            subscription_end = datetime.fromisoformat(subscription_end.replace('Z', '+00:00'))
        if subscription_end > datetime.now(timezone.utc):
            return True
    
    # Check free readings
    return user_data.get('free_readings_left', 0) > 0

async def use_reading(telegram_id: int):
    """Use one reading"""
    user_doc = await db.users.find_one({"telegram_id": telegram_id})
    if not user_doc:
        return
        
    if not user_doc.get('subscription_active'):
        new_count = max(0, user_doc.get('free_readings_left', 0) - 1)
        await db.users.update_one(
            {"telegram_id": telegram_id},
            {"$set": {"free_readings_left": new_count}}
        )

async def activate_subscription(telegram_id: int):
    """Activate premium subscription for 30 days"""
    subscription_end = datetime.now(timezone.utc) + timedelta(days=30)
    await db.users.update_one(
        {"telegram_id": telegram_id},
        {"$set": {
            "subscription_active": True,
            "subscription_end": subscription_end
        }}
    )

async def generate_astrology_reading(user_data: dict, question: str = "Дай мне общее астрологическое чтение") -> str:
    """Generate AI-powered astrology reading using OpenAI"""
    try:
        # Create a comprehensive prompt for astrology reading
        birth_info = ""
        if user_data.get('birth_date') and user_data.get('birth_time') and user_data.get('birth_place'):
            birth_info = f"""
Дата рождения: {user_data['birth_date']}
Время рождения: {user_data['birth_time']}
Место рождения: {user_data['birth_place']}
"""
        else:
            birth_info = "Данные о рождении пока не предоставлены."

        prompt = f"""Ты LunaAura - мудрый и сочувствующий астролог, который предоставляет персонализированные чтения для женщин. 
Ты сочетаешь древнюю астрологическую мудрость с современными психологическими инсайтами.

Информация о пользователе:
Имя: {user_data.get('first_name', 'Дорогая душа')}
{birth_info}

Вопрос пользователя: {question}

Предоставь теплое, проницательное астрологическое чтение, которое:
1. Отвечает на конкретный вопрос с эмпатией и мудростью
2. Включает соответствующие астрологические концепции, если данные о рождении доступны
3. Предлагает практические советы и поддержку
4. Использует поддерживающий, женственно-вдохновляющий тон
5. Содержит 150-300 слов
6. Использует подходящие эмодзи для магической атмосферы

Если данные о рождении не предоставлены, сосредоточься на общих советах и поощри их поделиться информацией о рождении для более персонализированных чтений.
Отвечай только на русском языке.
"""

        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.7
        )
        
        return response.choices[0].message.content.strip()
    
    except Exception as e:
        logger.error(f"Error generating astrology reading: {e}")
        return "Сейчас у меня проблемы с подключением к космическим энергиям. Пожалуйста, попробуйте через мгновение. ✨"

# Telegram Bot Handlers
@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    """Handle /start command"""
    user = await get_or_create_user(message.from_user)
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🌟 Открыть приложение LunaAura", 
            web_app=WebAppInfo(url=WEBAPP_URL)
        )],
        [
            InlineKeyboardButton(text="🔮 Получить чтение", callback_data="get_reading"),
            InlineKeyboardButton(text="💫 Подписка", callback_data="subscription")
        ],
        [InlineKeyboardButton(text="🌙 Указать данные рождения", callback_data="set_birth_data")]
    ])
    
    subscription_status = ""
    if user.subscription_active:
        subscription_status = "💎 Премиум подписка активна"
    else:
        subscription_status = f"✨ Осталось бесплатных чтений: {user.free_readings_left}"
    
    welcome_text = f"""🌙 Добро пожаловать в LunaAura, {user.first_name or 'прекрасная душа'}! 

Я твой персональный ИИ-астролог, готовый дать тебе космические советы и озарения.

✨ Что я могу для тебя сделать:
• Персонализированные астрологические чтения
• Ежедневные космические советы  
• Ответы на вопросы о любви, карьере и жизни
• Связь с мудростью звезд

{subscription_status}

🌟 С чего начнем твое космическое путешествие?"""

    await message.answer(welcome_text, reply_markup=keyboard)

@dp.callback_query(F.data == "subscription")
async def process_subscription(callback_query: types.CallbackQuery):
    """Handle subscription callback"""
    await callback_query.answer()
    
    user_doc = await db.users.find_one({"telegram_id": callback_query.from_user.id})
    
    # Check if already has active subscription
    if user_doc and user_doc.get('subscription_active'):
        subscription_end = user_doc.get('subscription_end')
        if isinstance(subscription_end, str):
            subscription_end = datetime.fromisoformat(subscription_end.replace('Z', '+00:00'))
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🌟 Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))],
            [InlineKeyboardButton(text="🔮 Получить чтение", callback_data="get_reading")]
        ])
        
        await callback_query.message.answer(
            f"💎 У вас уже есть активная премиум подписка!\n\n"
            f"⏰ Действует до: {subscription_end.strftime('%d.%m.%Y')}\n\n"
            f"✨ Наслаждайтесь безлимитными астрологическими чтениями!",
            reply_markup=keyboard
        )
        return
    
    # Show subscription options
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⭐ Купить подписку (100 Stars)", callback_data="buy_subscription")],
        [InlineKeyboardButton(text="🔮 Получить бесплатное чтение", callback_data="get_reading")],
        [InlineKeyboardButton(text="🌟 Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))]
    ])
    
    subscription_text = f"""💫 **Премиум подписка LunaAura**

🌟 **Что включает:**
• Безлимитные астрологические чтения
• Персонализированные ответы на любые вопросы  
• Доступ к расширенным функциям приложения
• Приоритетная поддержка

💎 **Цена:** 100 Telegram Stars (≈ $2)
⏰ **Период:** 30 дней

✨ Без подписки доступно {user_doc.get('free_readings_left', 3) if user_doc else 3} бесплатных чтения."""

    await callback_query.message.answer(subscription_text, parse_mode="Markdown", reply_markup=keyboard)

@dp.callback_query(F.data == "buy_subscription")
async def process_buy_subscription(callback_query: types.CallbackQuery):
    """Handle buy subscription callback"""
    await callback_query.answer()
    
    # Create invoice for Telegram Stars
    prices = [LabeledPrice(label=SUBSCRIPTION_TITLE, amount=SUBSCRIPTION_PRICE)]
    
    try:
        await bot.send_invoice(
            chat_id=callback_query.from_user.id,
            title=SUBSCRIPTION_TITLE,
            description=SUBSCRIPTION_DESCRIPTION,
            payload=f"subscription_{callback_query.from_user.id}_{datetime.now().timestamp()}",
            provider_token="",  # Empty for Telegram Stars
            currency="XTR",  # Telegram Stars currency
            prices=prices
        )
    except Exception as e:
        logger.error(f"Error sending invoice: {e}")
        await callback_query.message.answer(
            "😔 Произошла ошибка при создании счета. Попробуйте позже или обратитесь в поддержку."
        )

@dp.pre_checkout_query()
async def process_pre_checkout_query(pre_checkout_query: types.PreCheckoutQuery):
    """Handle pre-checkout query"""
    await bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)

@dp.message(F.successful_payment)
async def process_successful_payment(message: types.Message):
    """Handle successful payment"""
    try:
        # Activate subscription
        await activate_subscription(message.from_user.id)
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔮 Получить первое премиум чтение", callback_data="get_reading")],
            [InlineKeyboardButton(text="🌟 Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))]
        ])
        
        await message.answer(
            f"🎉 **Поздравляем!** Премиум подписка активирована!\n\n"
            f"💎 Теперь у вас есть доступ к:\n"
            f"• Безлимитным астрологическим чтениям\n"
            f"• Персонализированным советам\n"
            f"• Всем функциям приложения\n\n"
            f"✨ Подписка активна на 30 дней. Наслаждайтесь магией звезд!",
            parse_mode="Markdown",
            reply_markup=keyboard
        )
        
    except Exception as e:
        logger.error(f"Error processing payment: {e}")
        await message.answer(
            "Спасибо за оплату! Если у вас возникли проблемы с активацией подписки, обратитесь в поддержку."
        )

@dp.callback_query(F.data == "get_reading")
async def process_get_reading(callback_query: types.CallbackQuery):
    """Handle get reading callback"""
    await callback_query.answer()
    
    user_doc = await db.users.find_one({"telegram_id": callback_query.from_user.id})
    
    if not user_doc:
        await callback_query.message.answer("Ошибка: пользователь не найден. Попробуйте /start")
        return
    
    # Check if can get reading
    if not await can_get_reading(user_doc):
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="⭐ Купить подписку", callback_data="buy_subscription")],
            [InlineKeyboardButton(text="🌟 Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))]
        ])
        
        await callback_query.message.answer(
            "😔 У вас закончились бесплатные чтения.\n\n"
            "💫 Оформите премиум подписку для безлимитного доступа к мудрости звезд!",
            reply_markup=keyboard
        )
        return
    
    # Generate reading
    reading = await generate_astrology_reading(user_doc or {})
    
    # Use reading
    await use_reading(callback_query.from_user.id)
    
    # Save reading to database
    reading_obj = AstrologyReading(
        user_id=user_doc.get('id') if user_doc else str(uuid.uuid4()),
        telegram_id=callback_query.from_user.id,
        question="Общее чтение по запросу через бота",
        reading=reading,
        birth_data=user_doc if user_doc else None
    )
    
    await db.readings.insert_one(reading_obj.dict())
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌟 Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))],
        [InlineKeyboardButton(text="🔮 Еще одно чтение", callback_data="get_reading")]
    ])
    
    await callback_query.message.answer(f"🌟 **Ваше чтение от LunaAura** ✨\n\n{reading}", 
                                       parse_mode="Markdown", reply_markup=keyboard)

@dp.callback_query(F.data == "set_birth_data")
async def process_set_birth_data(callback_query: types.CallbackQuery):
    """Handle set birth data callback"""
    await callback_query.answer()
    
    instructions = """🌙 **Укажите ваши данные рождения** 

Для самых точных и персонализированных чтений мне нужна ваша информация о рождении.

Пожалуйста, отправьте данные в таком формате:
`ГГГГ-ММ-ДД ЧЧ:ММ Город, Страна`

Пример:
`1995-08-15 14:30 Москва, Россия`

Это поможет мне рассчитать вашу натальную карту и дать глубоко персонализированные космические озарения! ✨"""

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
                        [InlineKeyboardButton(text="🔮 Получить персональное чтение", callback_data="get_reading")],
                        [InlineKeyboardButton(text="🌟 Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))]
                    ])
                    
                    await message.answer(
                        f"🌙 Прекрасно! Я сохранила ваши данные рождения:\n"
                        f"📅 Дата: {date_part}\n"
                        f"⏰ Время: {time_part}\n"
                        f"📍 Место: {place_part}\n\n"
                        f"Теперь я могу дать вам глубоко персонализированные чтения! ✨",
                        reply_markup=keyboard
                    )
                    return
        except Exception as e:
            logger.error(f"Error processing birth data: {e}")
    
    # Treat as question for astrology reading
    user_doc = await db.users.find_one({"telegram_id": message.from_user.id})
    if not user_doc:
        await message.answer("Пожалуйста, начните с команды /start")
        return
    
    # Check if can get reading
    if not await can_get_reading(user_doc):
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="⭐ Купить подписку", callback_data="buy_subscription")]
        ])
        
        await message.answer(
            "😔 У вас закончились бесплатные чтения.\n\n"
            "💫 Оформите премиум подписку для безлимитного доступа!",
            reply_markup=keyboard
        )
        return
    
    # Generate personalized reading
    reading = await generate_astrology_reading(user_doc, text)
    
    # Use reading
    await use_reading(message.from_user.id)
    
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
        [InlineKeyboardButton(text="🌟 Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))],
        [InlineKeyboardButton(text="🔮 Задать другой вопрос", callback_data="get_reading")]
    ])
    
    await message.answer(f"✨ **Ваше персональное чтение** 🌟\n\n{reading}", 
                        parse_mode="Markdown", reply_markup=keyboard)

# API Routes
@api_router.get("/")
async def root():
    return {"message": "LunaAura API - Ваши космические советы ждут ✨"}

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
        webhook_url = f"{os.environ.get('REACT_APP_BACKEND_URL', WEBAPP_URL)}/api/webhook/telegram"
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