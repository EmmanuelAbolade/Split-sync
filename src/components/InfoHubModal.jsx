// src/components/InfoHubModal.jsx
// Help and Information modal — tabbed interface with Getting Started,
// Features, Tutorials (embedded YouTube), and Contact sections.

import { useState } from 'react';
import { X, HelpCircle, PlayCircle, Mail, MessageSquare, BookOpen, CheckCircle } from 'lucide-react';

export default function InfoHubModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('getting-started');

  if (!isOpen) return null;

  const tabs = [
    { id: 'getting-started', label: 'Getting Started', icon: BookOpen },
    { id: 'features',        label: 'Features',        icon: CheckCircle },
    { id: 'tutorials',       label: 'Tutorials',       icon: PlayCircle },
    { id: 'contact',         label: 'Contact Us',      icon: Mail },
  ];

  const features = [
    { title: 'Expense Splitting',        desc: 'Split by equal share, percentage, exact amount, or weighted shares.' },
    { title: 'Multi-Currency Support',   desc: 'Each group has its own currency. Balances are shown per currency with no conversion applied.' },
    { title: 'Payment Integrations',     desc: 'Settle via PayPal, Revolut, or SEPA bank transfer directly from the app.' },
    { title: 'Receipt Scanner',          desc: 'Scan a receipt with your camera to auto-fill expense title, amount, and date.' },
    { title: 'Real-Time Balances',       desc: 'Balances update instantly when expenses or payments are recorded.' },
    { title: 'Biometric Authentication', desc: 'Secure your account and payments with fingerprint or Face ID.' },
    { title: 'Spending Analytics',       desc: 'View charts and breakdowns of your spending per group in the Stats tab.' },
    { title: 'QR Code Invites',          desc: 'Share a scannable QR code to invite members to your group.' },
    { title: 'Dark Mode',                desc: 'Toggle dark mode in Settings under Appearance.' },
    { title: 'PWA Install',              desc: 'Install Split-Sync to your home screen for a native app experience.' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-gray-900/50 max-w-2xl w-full my-4 flex flex-col max-h-[90vh]">

        {/* Sticky header + tabs */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 rounded-t-2xl">

          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0">
                <HelpCircle size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Help and Information</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Everything you need to know about Split-Sync</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition p-1"
            >
              <X size={22} />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition whitespace-nowrap text-sm ${
                      activeTab === tab.id
                        ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 font-medium'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Icon size={15} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Scrollable content */}
        <div className="p-6 overflow-y-auto flex-1">

          {/* Getting Started tab */}
          {activeTab === 'getting-started' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Welcome to Split-Sync</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Split-Sync makes it easy to share expenses with friends, family, and roommates.
                  No more awkward money conversations or confusion about who owes what.
                </p>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-3">Quick Start Guide</h4>
                <ol className="space-y-3">
                  {[
                    { n: 1, title: 'Create a Group',    desc: 'Tap + on the Dashboard to set up a new group' },
                    { n: 2, title: 'Invite Members',    desc: 'Share an invite link or QR code. Members must join before you can add expenses.' },
                    { n: 3, title: 'Add Expenses',      desc: 'Tap Add Expense to record who paid and how to split.' },
                    { n: 4, title: 'View Balances',     desc: 'See who owes what in real time inside the group.' },
                    { n: 5, title: 'Settle Up',         desc: 'Pay via SEPA, PayPal, or Revolut directly from the app.' },
                  ].map((step) => (
                    <li key={step.n} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 dark:bg-indigo-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {step.n}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{step.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{step.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2 flex items-center gap-2">
                  <HelpCircle size={16} />
                  Pro Tips
                </h4>
                <ul className="space-y-1.5 text-sm text-yellow-800 dark:text-yellow-300">
                  <li>Set up your payment methods in Profile before settling up</li>
                  <li>Enable biometric login in Settings for faster secure access</li>
                  <li>Use receipt scanning to add expenses in seconds</li>
                  <li>Check Analytics for spending breakdowns per group</li>
                </ul>
              </div>
            </div>
          )}

          {/* Features tab */}
          {activeTab === 'features' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Core Features</h3>
              {features.map((f, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <CheckCircle size={16} className="text-indigo-500 dark:text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.title}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tutorials tab */}
          {activeTab === 'tutorials' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Video Guides</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Short video guides to help you get the most out of Split-Sync.
                </p>
              </div>

              {/* Video 1 - Getting Started (live) */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Getting Started with Split-Sync
                </h4>
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-black">
                  <div className="relative w-full" style={{ paddingBottom: '177.78%' }}>
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src="https://www.youtube.com/embed/Ke0iaIlBhtU"
                      title="Getting Started with Split-Sync"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
                <a
                  href="https://youtube.com/shorts/Ke0iaIlBhtU"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  <PlayCircle size={13} />
                  Open in YouTube
                </a>
              </div>

              {/* Video 2 - Coming Soon */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">How to Split Expenses</h4>
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center py-10">
                  <div className="text-center">
                    <PlayCircle size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 dark:text-gray-500">Coming soon</p>
                  </div>
                </div>
              </div>

              {/* Video 3 - Coming Soon */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Settling Up with PayPal, Revolut and SEPA</h4>
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center py-10">
                  <div className="text-center">
                    <PlayCircle size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 dark:text-gray-500">Coming soon</p>
                  </div>
                </div>
              </div>

              {/* Video 4 - Coming Soon */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Receipt Scanning and Analytics</h4>
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center py-10">
                  <div className="text-center">
                    <PlayCircle size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 dark:text-gray-500">Coming soon</p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Contact tab */}
          {activeTab === 'contact' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Get in Touch</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Have questions, feedback, or need help? We are here for you.
                </p>
              </div>

              <div className="grid gap-4">
                <a
                  href="mailto:support@split-sync.com"
                  className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
                >
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                    <Mail size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-0.5">Email Support</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">support@split-sync.com</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">We typically respond within 24 hours</p>
                  </div>
                </a>

                <a
                  href="https://wa.me/+3530899891720"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition"
                >
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center shrink-0">
                    <MessageSquare size={20} className="text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-0.5">WhatsApp Support</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Message us directly</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Quick responses during business hours</p>
                  </div>
                </a>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <p><strong>Developer:</strong> Emmanuel Abolade</p>
                <p><strong>Institution:</strong> South East Technological University Carlow</p>
                <p><strong>Project:</strong> BSc Software Development Final Year Project</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
