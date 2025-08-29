import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Telegram WebApp SDK
const tg = window.Telegram?.WebApp;

const LunaAura = () => {
  const [user, setUser] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    // Initialize Telegram WebApp
    if (tg) {
      tg.ready();
      tg.expand();
      
      // Get user data from Telegram
      const telegramUser = tg.initDataUnsafe?.user;
      if (telegramUser) {
        fetchUserData(telegramUser.id);
      } else {
        // No telegram user data, enable demo mode after delay
        setTimeout(() => {
          setDemoMode(true);
          setUser({
            telegram_id: 999999999,
            first_name: "Демо Пользователь",
            username: "demo_user",
            subscription_active: true
          });
          setReadings([
            {
              id: "demo1",
              question: "Что меня ждет в любви?",
              reading: "🌟 Венера входит в ваш романтический сектор, принося возможности для глубокой связи. Ваша сердечная чакра открывается новым возможностям. Доверьтесь интуиции и будьте открыты неожиданным встречам. Вселенная выравнивается, чтобы принести вам любовь, которую вы заслуживаете. ✨💕",
              created_at: new Date().toISOString()
            },
            {
              id: "demo2", 
              question: "Стоит ли мне менять карьерный путь?",
              reading: "🌟 Марс в вашем карьерном секторе предполагает время для смелых действий. Ваша натальная карта показывает сильные лидерские качества, готовые проявиться. Космические энергии поддерживают профессиональный рост и новые предприятия. Слушайте свой внутренний голос - он знает путь к вашему истинному призванию. 🌟",
              created_at: new Date(Date.now() - 24*60*60*1000).toISOString()
            },
            {
              id: "demo3",
              question: "Как найти внутренний покой?",
              reading: "🌙 Меркурий ретроградный в вашем духовном доме призывает к медитации и самоанализу. Текущая фаза луны усиливает ваши интуитивные способности. Практикуйте осознанность и соединяйтесь с природой. Ваши духовные наставники посылают сообщения через синхронности. Покой приходит изнутри. 🧘‍♀️✨",
              created_at: new Date(Date.now() - 48*60*60*1000).toISOString()
            }
          ]);
          setLoading(false);
        }, 2000);
      }
    } else {
      // No Telegram WebApp, enable demo mode immediately
      setTimeout(() => {
        setDemoMode(true);
        setUser({
          telegram_id: 999999999,
          first_name: "Демо Пользователь",
          username: "demo_user",
          birth_date: "1995-08-15",
          birth_time: "14:30",
          birth_place: "Москва, Россия",
          subscription_active: false,
          free_readings_left: 2
        });
        setReadings([
          {
            id: "demo1",
            question: "Что меня ждет в любви?",
            reading: "🌟 Венера входит в ваш романтический сектор, принося возможности для глубокой связи. Ваша сердечная чакра открывается новым возможностям. Доверьтесь интуиции и будьте открыты неожиданным встречам. Вселенная выравнивается, чтобы принести вам любовь, которую вы заслуживаете. ✨💕",
            created_at: new Date().toISOString()
          },
          {
            id: "demo2", 
            question: "Стоит ли мне менять карьерный путь?",
            reading: "🌟 Марс в вашем карьерном секторе предполагает время для смелых действий. Ваша натальная карта показывает сильные лидерские качества, готовые проявиться. Космические энергии поддерживают профессиональный рост и новые предприятия. Слушайте свой внутренний голос - он знает путь к вашему истинному призванию. 🌟",
            created_at: new Date(Date.now() - 24*60*60*1000).toISOString()
          }
        ]);
        setLoading(false);
      }, 1500);
    }
  }, []);

  const fetchUserData = async (telegramId) => {
    try {
      const response = await axios.get(`${API}/user/${telegramId}`);
      setUser(response.data);
      fetchReadings(telegramId);
    } catch (error) {
      console.log("Пользователь не найден, будет создан при первом взаимодействии с ботом");
      setUser({ telegram_id: telegramId });
    } finally {
      setLoading(false);
    }
  };

  const fetchReadings = async (telegramId) => {
    try {
      const response = await axios.get(`${API}/readings/${telegramId}`);
      setReadings(response.data);
    } catch (error) {
      console.error("Ошибка при получении чтений:", error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-purple-300 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-pink-300 border-t-transparent rounded-full animate-ping mx-auto opacity-20"></div>
          </div>
          <p className="text-lg font-medium">Загружаем ваш космический профиль...</p>
          {!tg && (
            <p className="text-sm text-purple-300 mt-2 animate-pulse">
              Режим предпросмотра... ✨
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <div className="bg-black bg-opacity-30 backdrop-blur-lg border-b border-purple-500/30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white flex items-center">
            <span className="text-3xl mr-2 animate-bounce">🌙</span>
            LunaAura
            {demoMode && <span className="ml-2 text-xs bg-purple-600 px-2 py-1 rounded animate-pulse">ДЕМО</span>}
          </h1>
          <p className="text-purple-200 text-sm">
            {demoMode ? "Демо превью - подключитесь через Telegram для полных функций" : "Ваш персональный ИИ-астролог"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex space-x-1 bg-black bg-opacity-30 rounded-xl p-1 backdrop-blur-sm">
          {[
            { key: 'dashboard', label: '🏠 Главная', icon: '🏠' },
            { key: 'readings', label: '🔮 Чтения', icon: '🔮' },
            { key: 'profile', label: '👤 Профиль', icon: '👤' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 transform ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                  : 'text-purple-200 hover:text-white hover:bg-purple-700/30 hover:scale-102'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Demo Info */}
            {demoMode && (
              <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 backdrop-blur-sm rounded-xl border border-blue-500/30 p-4 animate-fadeIn">
                <div className="text-center">
                  <h3 className="text-lg font-bold text-blue-200 mb-2">🤖 Демо-режим LunaAura</h3>
                  <p className="text-blue-100 text-sm mb-3">
                    Это предварительный просмотр приложения. Для полного функционала используйте Telegram бот:
                  </p>
                  <div className="bg-black/30 rounded-lg p-3 text-left text-sm">
                    <p className="text-blue-200 mb-1"><strong>1.</strong> Найдите бота @LunaAIAura_bot в Telegram</p>
                    <p className="text-blue-200 mb-1"><strong>2.</strong> Отправьте команду /start</p>
                    <p className="text-blue-200"><strong>3.</strong> Задавайте вопросы и получайте персональные астрологические чтения!</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Welcome Card */}
            <div className="bg-black bg-opacity-30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6 animate-slideUp">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Добро пожаловать, {user?.first_name || 'Прекрасная душа'}! 🌟
                </h2>
                <p className="text-purple-200 mb-4">
                  Ваше космическое путешествие ждет. Звезды выровнялись, чтобы принести вам руководство и мудрость.
                </p>
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-lg p-4 text-center backdrop-blur-sm transform hover:scale-105 transition-all duration-300">
                    <div className="text-2xl mb-2">📖</div>
                    <div className="text-lg font-semibold text-white">{readings.length}</div>
                    <div className="text-sm text-purple-200">Всего чтений</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-600/30 to-purple-600/30 rounded-lg p-4 text-center backdrop-blur-sm transform hover:scale-105 transition-all duration-300">
                    <div className="text-2xl mb-2">🎂</div>
                    <div className="text-lg font-semibold text-white">
                      {user?.birth_date ? '✓' : '?'}
                    </div>
                    <div className="text-sm text-purple-200">Данные рождения</div>
                  </div>
                  <div className="bg-gradient-to-br from-pink-600/30 to-purple-600/30 rounded-lg p-4 text-center backdrop-blur-sm transform hover:scale-105 transition-all duration-300">
                    <div className="text-2xl mb-2">{user?.subscription_active ? '💎' : '✨'}</div>
                    <div className="text-lg font-semibold text-white">
                      {user?.subscription_active ? 'Премиум' : user?.free_readings_left || 0}
                    </div>
                    <div className="text-sm text-purple-200">
                      {user?.subscription_active ? 'Подписка' : 'Осталось'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-black bg-opacity-30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6 animate-slideUp">
              <h3 className="text-xl font-bold text-white mb-4">🌟 Быстрые действия</h3>
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => demoMode ? alert('Для задавания вопросов используйте бота в Telegram!') : tg?.close()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg"
                >
                  🔮 {demoMode ? 'Задать вопрос боту (Telegram)' : 'Задать вопрос в чате'}
                </button>
                <button 
                  onClick={() => setActiveTab('readings')}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
                >
                  📖 Просмотреть все чтения
                </button>
                <button 
                  onClick={() => setActiveTab('profile')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg"
                >
                  🌙 Обновить данные рождения
                </button>
              </div>
            </div>

            {/* Recent Reading */}
            {readings.length > 0 && (
              <div className="bg-black bg-opacity-30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6 animate-slideUp">
                <h3 className="text-xl font-bold text-white mb-4">🔮 Ваше последнее чтение</h3>
                <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg p-4 backdrop-blur-sm">
                  <div className="text-sm text-purple-300 mb-2">
                    {formatDate(readings[0].created_at)}
                  </div>
                  <div className="text-purple-100 mb-2 font-medium">
                    "{readings[0].question}"
                  </div>
                  <div className="text-white text-sm leading-relaxed">
                    {readings[0].reading.substring(0, 200)}
                    {readings[0].reading.length > 200 && '...'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'readings' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-6">🔮 История ваших чтений</h2>
            
            {readings.length === 0 ? (
              <div className="bg-black bg-opacity-30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-8 text-center animate-fadeIn">
                <div className="text-6xl mb-4 animate-bounce">🔮</div>
                <h3 className="text-xl font-bold text-white mb-2">Пока нет чтений</h3>
                <p className="text-purple-200 mb-4">
                  Начните свое космическое путешествие, задав первый вопрос в чате!
                </p>
                <button 
                  onClick={() => demoMode ? alert('Для задавания вопросов используйте бота в Telegram!') : tg?.close()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 px-6 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg"
                >
                  {demoMode ? 'Задать первый вопрос (Telegram)' : 'Задать первый вопрос'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {readings.map((reading, index) => (
                  <div key={reading.id} className="bg-black bg-opacity-30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6 animate-slideUp hover:border-purple-400/50 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-sm text-purple-300">
                        {formatDate(reading.created_at)}
                      </div>
                      <div className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded">
                        #{readings.length - index}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div className="text-sm font-medium text-purple-200 mb-1">Ваш вопрос:</div>
                      <div className="text-white font-medium">"{reading.question}"</div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-purple-200 mb-2">Ответ LunaAura:</div>
                      <div className="text-purple-100 leading-relaxed whitespace-pre-wrap">
                        {reading.reading}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">👤 Ваш профиль</h2>
            
            {/* Basic Info */}
            <div className="bg-black bg-opacity-30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6 animate-slideUp">
              <h3 className="text-xl font-bold text-white mb-4">Основная информация</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-purple-200">Имя:</span>
                  <span className="text-white">{user?.first_name} {user?.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-200">Имя пользователя:</span>
                  <span className="text-white">@{user?.username || 'Не указано'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-200">Участник с:</span>
                  <span className="text-white">{user?.created_at ? formatDate(user.created_at) : 'Недавно присоединился'}</span>
                </div>
              </div>
            </div>

            {/* Subscription Status */}
            <div className="bg-black bg-opacity-30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6 animate-slideUp">
              <h3 className="text-xl font-bold text-white mb-4">💫 Статус подписки</h3>
              
              {user?.subscription_active ? (
                <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">💎</span>
                    <span className="text-lg font-semibold text-white">Премиум подписка активна</span>
                  </div>
                  <div className="text-purple-200 text-sm">
                    ✨ Безлимитные астрологические чтения
                  </div>
                  {user?.subscription_end && (
                    <div className="text-purple-300 text-sm mt-1">
                      Действует до: {formatDate(user.subscription_end)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">✨</span>
                    <span className="text-lg font-semibold text-white">Бесплатный план</span>
                  </div>
                  <div className="text-blue-200 text-sm">
                    Осталось бесплатных чтений: {user?.free_readings_left || 0}
                  </div>
                  <div className="mt-3">
                    <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-purple-700 hover:to-pink-700 transition-all">
                      Обновить до премиум
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Birth Data */}
            <div className="bg-black bg-opacity-30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6 animate-slideUp">
              <h3 className="text-xl font-bold text-white mb-4">🌙 Данные рождения</h3>
              
              {user?.birth_date ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-purple-200">Дата рождения:</span>
                    <span className="text-white">{user.birth_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-200">Время рождения:</span>
                    <span className="text-white">{user.birth_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-200">Место рождения:</span>
                    <span className="text-white">{user.birth_place}</span>
                  </div>
                  <div className="mt-4 p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-lg">
                    <div className="text-green-200 text-sm">
                      ✅ Ваши данные рождения полные! Это позволяет мне давать вам глубоко персонализированные чтения.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-4 animate-bounce">🌙</div>
                  <h4 className="text-lg font-bold text-white mb-2">Данные рождения не указаны</h4>
                  <p className="text-purple-200 mb-4">
                    Для получения самых точных и персонализированных чтений, пожалуйста, предоставьте информацию о вашем рождении в чате.
                  </p>
                  <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 text-left">
                    <div className="text-blue-200 text-sm font-medium mb-2">Как указать данные рождения:</div>
                    <div className="text-blue-100 text-sm">
                      1. Вернитесь в чат с ботом<br/>
                      2. Отправьте информацию в формате:<br/>
                      <code className="bg-blue-800/50 px-2 py-1 rounded text-xs">
                        ГГГГ-ММ-ДД ЧЧ:ММ Город, Страна
                      </code><br/>
                      <strong>Пример:</strong> 1995-08-15 14:30 Москва, Россия
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="bg-black bg-opacity-30 backdrop-blur-lg rounded-xl border border-purple-500/30 p-6 animate-slideUp">
              <h3 className="text-xl font-bold text-white mb-4">📊 Ваше космическое путешествие</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg p-4">
                  <div className="text-3xl font-bold text-purple-400">{readings.length}</div>
                  <div className="text-sm text-purple-200">Всего чтений</div>
                </div>
                <div className="text-center bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-lg p-4">
                  <div className="text-3xl font-bold text-blue-400">
                    {readings.length > 0 ? Math.ceil((Date.now() - new Date(readings[readings.length - 1].created_at)) / (1000 * 60 * 60 * 24)) : 0}
                  </div>
                  <div className="text-sm text-blue-200">Дней с первого чтения</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <LunaAura />
    </div>
  );
}

export default App;