import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Telegram WebApp SDK
const tg = window.Telegram?.WebApp;

const StarWeaver = () => {
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
            first_name: "Demo User",
            username: "demo_user"
          });
          setReadings([
            {
              id: "demo1",
              question: "What does my future hold in love?",
              reading: "The stars reveal that Venus is entering your romantic sector, bringing opportunities for deep connection. Your heart chakra is opening to new possibilities. Trust your intuition and be open to unexpected encounters. The universe is aligning to bring you the love you deserve. ✨💕",
              created_at: new Date().toISOString()
            },
            {
              id: "demo2", 
              question: "Should I change my career path?",
              reading: "Mars in your career sector suggests it's time for bold action. Your natal chart shows strong leadership qualities that are ready to emerge. The cosmic energies support professional growth and new ventures. Listen to your inner voice - it knows the path to your true calling. 🌟",
              created_at: new Date(Date.now() - 24*60*60*1000).toISOString()
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
          first_name: "Demo User",
          username: "demo_user",
          birth_date: "1995-08-15",
          birth_time: "14:30",
          birth_place: "Moscow, Russia"
        });
        setReadings([
          {
            id: "demo1",
            question: "What does my future hold in love?",
            reading: "The stars reveal that Venus is entering your romantic sector, bringing opportunities for deep connection. Your heart chakra is opening to new possibilities. Trust your intuition and be open to unexpected encounters. The universe is aligning to bring you the love you deserve. ✨💕",
            created_at: new Date().toISOString()
          },
          {
            id: "demo2", 
            question: "Should I change my career path?",
            reading: "Mars in your career sector suggests it's time for bold action. Your natal chart shows strong leadership qualities that are ready to emerge. The cosmic energies support professional growth and new ventures. Listen to your inner voice - it knows the path to your true calling. 🌟",
            created_at: new Date(Date.now() - 24*60*60*1000).toISOString()
          },
          {
            id: "demo3",
            question: "How can I find inner peace?",
            reading: "Mercury retrograde in your spiritual house calls for meditation and self-reflection. The moon's current phase amplifies your intuitive powers. Practice mindfulness and connect with nature. Your spirit guides are sending you messages through synchronicities. Peace comes from within. 🧘‍♀️✨",
            created_at: new Date(Date.now() - 48*60*60*1000).toISOString()
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
      console.log("User not found, will be created on first bot interaction");
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
      console.error("Error fetching readings:", error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Loading your cosmic profile...</p>
          {!tg && (
            <p className="text-sm text-purple-300 mt-2">
              Preview mode loading... ✨
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black bg-opacity-20 backdrop-blur-sm border-b border-purple-500/30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white flex items-center">
            <span className="text-3xl mr-2">🌟</span>
            StarWeaver
          </h1>
          <p className="text-purple-200 text-sm">Your Personal AI Astrologer</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex space-x-1 bg-black bg-opacity-20 rounded-lg p-1">
          {[
            { key: 'dashboard', label: '🏠 Dashboard', icon: '🏠' },
            { key: 'readings', label: '✨ Readings', icon: '✨' },
            { key: 'profile', label: '👤 Profile', icon: '👤' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-purple-200 hover:text-white hover:bg-purple-700/30'
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
            {/* Welcome Card */}
            <div className="bg-black bg-opacity-20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">
                  Welcome, {user?.first_name || 'Beautiful Soul'}! ✨
                </h2>
                <p className="text-purple-200 mb-4">
                  Your cosmic journey awaits. The stars have aligned to bring you guidance and wisdom.
                </p>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-purple-600/20 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">📖</div>
                    <div className="text-lg font-semibold text-white">{readings.length}</div>
                    <div className="text-sm text-purple-200">Total Readings</div>
                  </div>
                  <div className="bg-blue-600/20 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">🎂</div>
                    <div className="text-lg font-semibold text-white">
                      {user?.birth_date ? '✓' : '?'}
                    </div>
                    <div className="text-sm text-purple-200">Birth Data</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-black bg-opacity-20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
              <h3 className="text-xl font-bold text-white mb-4">🌟 Quick Actions</h3>
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => tg?.close()}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all"
                >
                  ✨ Ask a Question in Chat
                </button>
                <button 
                  onClick={() => setActiveTab('readings')}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all"
                >
                  📖 View All Readings
                </button>
                <button 
                  onClick={() => setActiveTab('profile')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
                >
                  🎂 Update Birth Data
                </button>
              </div>
            </div>

            {/* Recent Reading */}
            {readings.length > 0 && (
              <div className="bg-black bg-opacity-20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                <h3 className="text-xl font-bold text-white mb-4">🔮 Your Latest Reading</h3>
                <div className="bg-purple-900/30 rounded-lg p-4">
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
            <h2 className="text-2xl font-bold text-white mb-6">✨ Your Reading History</h2>
            
            {readings.length === 0 ? (
              <div className="bg-black bg-opacity-20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-8 text-center">
                <div className="text-6xl mb-4">🔮</div>
                <h3 className="text-xl font-bold text-white mb-2">No Readings Yet</h3>
                <p className="text-purple-200 mb-4">
                  Start your cosmic journey by asking your first question in the chat!
                </p>
                <button 
                  onClick={() => tg?.close()}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-6 rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all"
                >
                  Ask Your First Question
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {readings.map((reading, index) => (
                  <div key={reading.id} className="bg-black bg-opacity-20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-sm text-purple-300">
                        {formatDate(reading.created_at)}
                      </div>
                      <div className="text-xs text-purple-400">
                        #{readings.length - index}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div className="text-sm font-medium text-purple-200 mb-1">Your Question:</div>
                      <div className="text-white font-medium">"{reading.question}"</div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-purple-200 mb-2">StarWeaver's Guidance:</div>
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
            <h2 className="text-2xl font-bold text-white mb-6">👤 Your Profile</h2>
            
            {/* Basic Info */}
            <div className="bg-black bg-opacity-20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
              <h3 className="text-xl font-bold text-white mb-4">Basic Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-purple-200">Name:</span>
                  <span className="text-white">{user?.first_name} {user?.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-200">Username:</span>
                  <span className="text-white">@{user?.username || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-200">Member Since:</span>
                  <span className="text-white">{user?.created_at ? formatDate(user.created_at) : 'Recently joined'}</span>
                </div>
              </div>
            </div>

            {/* Birth Data */}
            <div className="bg-black bg-opacity-20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
              <h3 className="text-xl font-bold text-white mb-4">🎂 Birth Data</h3>
              
              {user?.birth_date ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-purple-200">Birth Date:</span>
                    <span className="text-white">{user.birth_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-200">Birth Time:</span>
                    <span className="text-white">{user.birth_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-200">Birth Place:</span>
                    <span className="text-white">{user.birth_place}</span>
                  </div>
                  <div className="mt-4 p-4 bg-green-900/30 rounded-lg">
                    <div className="text-green-200 text-sm">
                      ✅ Your birth data is complete! This allows me to give you deeply personalized readings.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-4">🌙</div>
                  <h4 className="text-lg font-bold text-white mb-2">Birth Data Not Set</h4>
                  <p className="text-purple-200 mb-4">
                    To receive the most accurate and personalized readings, please provide your birth information in the chat.
                  </p>
                  <div className="bg-blue-900/30 rounded-lg p-4 text-left">
                    <div className="text-blue-200 text-sm font-medium mb-2">How to set your birth data:</div>
                    <div className="text-blue-100 text-sm">
                      1. Go back to the chat<br/>
                      2. Send your birth info in this format:<br/>
                      <code className="bg-blue-800/50 px-2 py-1 rounded text-xs">
                        YYYY-MM-DD HH:MM City, Country
                      </code><br/>
                      <strong>Example:</strong> 1990-05-15 14:30 New York, USA
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="bg-black bg-opacity-20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
              <h3 className="text-xl font-bold text-white mb-4">📊 Your Cosmic Journey</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">{readings.length}</div>
                  <div className="text-sm text-purple-200">Total Readings</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {readings.length > 0 ? Math.ceil((Date.now() - new Date(readings[readings.length - 1].created_at)) / (1000 * 60 * 60 * 24)) : 0}
                  </div>
                  <div className="text-sm text-blue-200">Days Since First Reading</div>
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
      <StarWeaver />
    </div>
  );
}

export default App;