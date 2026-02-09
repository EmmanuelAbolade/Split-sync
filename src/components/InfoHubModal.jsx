// src/components/InfoHubModal.jsx
import { useState } from 'react';
import { X, HelpCircle, PlayCircle, Mail, MessageSquare, BookOpen, CheckCircle } from 'lucide-react';

export default function InfoHubModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('getting-started');

  if (!isOpen) return null;

  const tabs = [
    { id: 'getting-started', label: 'Getting Started', icon: BookOpen },
    { id: 'features', label: 'Features', icon: CheckCircle },
    { id: 'tutorials', label: 'Tutorials', icon: PlayCircle },
    { id: 'contact', label: 'Contact Us', icon: Mail },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-gray-900/50 max-w-2xl w-full my-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <HelpCircle size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Help & Information</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Everything you need to know about Split-Sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 font-medium'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Getting Started */}
          {activeTab === 'getting-started' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Welcome to Split-Sync! 👋</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Split-Sync makes it easy to share expenses with friends, family, roommates, and small groups like event planning teams, travel groups, and more. 
                  No more awkward money conversations and calculations, complicated spreadsheets and calendar notifications, or confusion about who owes what. Just simple, seamless expense sharing at your fingertips!
                </p>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-3">🚀 Quick Start Guide</h4>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 dark:bg-indigo-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Create a Group</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Click "Create Group" to set up a new group</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 dark:bg-indigo-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Send invite or Join a Group</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Click "Invite" to share an invite using QR code, Whatsapp etc. or join using an invite link (ensure members are added to the group before adding expenses)</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 dark:bg-indigo-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Add Expenses</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Tap "+" to record who paid and how to split</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 dark:bg-indigo-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">View Balances</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">See who owes what in real-time</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 dark:bg-indigo-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Settle Up</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Pay via SEPA, PayPal, or Revolut with biometric security</p>
                    </div>
                  </li>
                </ol>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2 flex items-center gap-2">
                  <HelpCircle size={18} />
                  Pro Tips
                </h4>
                <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-300">
                  <li>• Set up your payment methods in Profile for faster settlements</li>
                  <li>• Enable biometric authentication for secure payments</li>
                  <li>• Use receipt scanning to quickly add expenses</li>
                  <li>• Archive groups when you're done to keep things tidy</li>
                </ul>
              </div>
            </div>
          )}

          {/* Features */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Key Features</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Split-Sync is packed with features to make expense sharing effortless.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Smart Splitting</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Split expenses equally, by percentage, exact amounts, or custom shares. 
                        Perfect for any situation!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Receipt Scanning</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Scan receipts with Google Vision API for 85%+ accuracy. Add expenses in seconds!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={20} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Secure Payments</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Settle up with SEPA bank transfers, PayPal, or Revolut. Biometric authentication keeps your money safe.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={20} className="text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Real-time Balances</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        See who owes what instantly. All calculations happen automatically!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Easy Sharing</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Share group invites via WhatsApp, email, QR code, or direct link. Getting people in is quick!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tutorials */}
          {activeTab === 'tutorials' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Video Tutorials</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Watch these quick guides to master Split-Sync in minutes!
                </p>
              </div>

              <div className="space-y-4">
                <a
                  href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group"
                >
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition">
                    <PlayCircle size={32} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Getting Started with Split-Sync</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Learn the basics in 3 minutes</p>
                  </div>
                </a>

                <a
                  href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group"
                >
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition">
                    <PlayCircle size={32} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">How to Split Expenses</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Master all split methods</p>
                  </div>
                </a>

                <a
                  href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group"
                >
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition">
                    <PlayCircle size={32} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Settling Up with SEPA</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Secure payments made easy</p>
                  </div>
                </a>

                <a
                  href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group"
                >
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition">
                    <PlayCircle size={32} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Receipt Scanning Tutorial</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Add expenses in seconds</p>
                  </div>
                </a>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-300">
                  <strong>Note:</strong> These tutorial videos are always available here when you need them!
                </p>
              </div>
            </div>
          )}

          {/* Contact */}
          {activeTab === 'contact' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Get in Touch</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Have questions, feedback, or need help? We're here for you!
                </p>
              </div>

              <div className="grid gap-4">
                <a
                  href="mailto:support@split-sync.com"
                  className="flex items-start gap-4 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
                >
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail size={24} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Email Support</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">support@split-sync.com</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">We typically respond within 24 hours</p>
                  </div>
                </a>

                <a
                  href="https://wa.me/+3530899891720"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition"
                >
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={24} className="text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">WhatsApp Support</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Message us directly</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">Quick responses during business hours</p>
                  </div>
                </a>
              </div>

              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 dark:text-green-300 mb-2">📧 Contact Information</h4>
                <div className="space-y-2 text-sm text-green-800 dark:text-green-300">
                  <p><strong>Developer:</strong> Emmanuel Abolade</p>
                  <p><strong>Institution:</strong> South East Technological University Carlow</p>
                  <p><strong>Project:</strong> BSc Software Development Final Year Project</p>
                  <p><strong>Email:</strong> support@split-sync.com</p>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">💡 Before Contacting:</h4>
                <ul className="space-y-1 text-sm text-yellow-800 dark:text-yellow-300">
                  <li>• Check the "Getting Started" tab for basic help</li>
                  <li>• Watch tutorial videos for step-by-step guides</li>
                  <li>• Try logging out and back in if something isn't working</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
