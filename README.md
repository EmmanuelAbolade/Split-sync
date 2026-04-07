# Split-Sync 💰

> A modern Progressive Web Application for seamless smart expense management, bill splitting, and group payment tracking with integrated payment solutions.



## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Security & Privacy](#security--privacy)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [Academic Context](#academic-context)
- [License](#license)
- [Contact](#contact)



## Overview

**Split-Sync** is a comprehensive expense management and bill-splitting Progressive Web Application (PWA) designed to simplify financial tracking for groups, roommates, travelers, and friends. Built with modern web technologies and integrated payment solutions, Split-Sync ensures accurate expense tracking, automated balance calculations, and seamless settlements.

### Why Split-Sync?

- **Privacy-First Design**: End-to-end encryption, secure authentication, and privacy-preserving contact sync
- **Multiple Payment Methods**: Integrated PayPal, Revolut, and SEPA bank transfers
- **Progressive Web App**: Install on any device, works offline, native app experience
- **Multi-Currency Support**: EUR, USD, GBP with automatic currency handling
- **Smart Contact Sync**: Find friends using Split-Sync through privacy-preserving phone number matching
- **Real-Time Notifications**: Instant updates for expenses, settlements, and group activities
- **Advanced Split Methods**: Equal splits, percentage-based, exact amounts, and shares
- **Receipt Scanning**: OCR-powered receipt scanning with Google Cloud Vision API (planned)



##  Features

### Core Functionality

#### **User Management**
- **Secure Authentication**: Email/password and Google OAuth 2.0
- **Biometric Authentication**: WebAuthn-based fingerprint/face recognition for payment confirmations
- **Session Management**: Configurable auto-logout (5min, 10min, 20min, 30min, never)
- **Profile Management**: Customizable profiles with photo uploads via Cloudinary
- **Privacy-Preserving Contact Sync**: SHA-256 hashed phone number matching

#### **Group Management**
- **Flexible Group Creation**: Custom icons, names, and currencies
- **Multiple Invitation Methods**:
  - Quick Add from previous connections
  - Contact sync (find friends via phone contacts)
  - QR code scanning
  - Shareable invite links via whatsApp, SMS, Email etc.
- **Real-Time Updates**: Live expense and member updates via Firestore subscriptions
- **Member Management**: Add/remove members, role-based permissions

#### **Expense Entry and Tracking**
- **OCR receipt scanning**: Extract merchant name, total amount, transaction date and returns structured expense metadata
- **Four Split Methods**:
  1. **Equal Split**: Divide equally among selected participants
  2. **Percentage Split**: Custom percentage allocation (auto-adjusts to 100%)
  3. **Exact Amounts**: Specify exact amount per person
  4. **Shares**: Split by share ratios (e.g., 2:1:3)
- **Rich Expense Details**: Categories, descriptions, dates, receipts
- **Expense Categories**: 15+ categories with custom icons
- **Expense History**: Complete activity timeline with filters
- **Settlement Suggestions**: Smart balance calculation and optimal settlement paths

#### **Payment Integration**
- **PayPal Integration**: Direct payment links with PayPal
- **Revolut Support**: Payment links for Revolut users
- **SEPA Bank Transfers**: IBAN validation and transfer details
- **Manual Settlements**: Mark payments as sent/received offline outside the app
- **Biometric Confirmation**: Secure payment authorization
- **Amount Validation**: Method-specific limits (PayPal: €0.01-€60,000, SEPA: €0.01-€999,999.99)

#### **Notifications System**
- **Real-Time Notifications**: Bell icon with unread badge
- **Notification Types**:
  - Payment notifications (bidirectional)
  - New expense notifications
  - Group invitations
  - Settlement confirmations
- **In-App Notifications**: Dropdown with action buttons
- **Invitation Banners**: Prominent accept/decline UI

#### **User Experience**
- **Dark Mode**: Full dark mode support with system preference detection
- **Responsive Design**: Mobile-first design that works on all screen sizes
- **Offline Support**: PWA capabilities with service worker
- **Smooth Animations**: Tailwind CSS transitions and custom animations
- **Professional UI**: Lucide React icons, modern color schemes
- **Keyboard Navigation**: Full keyboard accessibility support



## Tech Stack

### Frontend
- **React 18.3.1**: Component-based UI library
- **React Router 7.1.1**: Client-side routing
- **Tailwind CSS 3.4.17**: Utility-first CSS framework
- **Lucide React 0.469.0**: Modern icon library
- **Zustand 5.0.2**: Lightweight state management

### Backend & Services
- **Firebase 11.0.2**:
  - Authentication (Email/Password, Google OAuth)
  - Firestore (NoSQL real-time database)
  - Cloud Storage (Image hosting)
  - Hosting (Static site deployment)
- **Google Cloud Vision API**: OCR receipt scanning
- **Cloudinary**: Image upload and optimization

### Security & Privacy
- **WebAuthn**: Biometric authentication
- **SHA-256**: Privacy-preserving contact matching
- **AES-256**: Data encryption at rest
- **TLS 1.3**: Transport layer security
- **Firestore Security Rules**: Fine-grained access control

### Development Tools
- **Create React App**: Project scaffolding
- **ESLint**: Code linting
- **Git**: Version control
- **Firebase CLI**: Deployment pipeline



## Getting Started

### Prerequisites

- **Node.js**: v16.x or higher
- **npm**: v8.x or higher
- **Firebase Account**: Free tier is sufficient
- **Google Cloud Account**: For Vision API (optional)
- **Cloudinary Account**: For image uploads (optional)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/EmmanuelAbolade/split-sync.git
cd split-sync-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server
npm start
```

The app will open at `http://localhost:3000`



## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/EmmanuelAbolade/split-sync.git
cd split-sync-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password and Google)
3. Create a Firestore database
4. Enable Storage
5. Copy your Firebase config

### 4. Environment Variables

Create a `.env` file in the root directory:
```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
REACT_APP_FIREBASE_PROJECT_ID=your_project_id_here
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
REACT_APP_FIREBASE_APP_ID=your_app_id_here

# Cloudinary Configuration (Optional)
REACT_APP_CLOUDINARY_CLOUD_NAME=your_cloud_name
REACT_APP_CLOUDINARY_UPLOAD_PRESET=your_preset

# Google Cloud Vision API (Optional)
REACT_APP_GOOGLE_CLOUD_VISION_KEY=your_api_key
```

### 5. Firestore Security Rules

Deploy the security rules from `firestore.rules`:
```bash
firebase deploy --only firestore:rules
```

### 6. Run Development Server
```bash
npm start
```



## Configuration

### Firestore Collections Structure
```
users/
  {userId}/
    - displayName
    - email
    - photoURL
    - phoneNumber (optional)
    - phoneHash (SHA-256)
    - sessionTimeout
    - paymentMethods
    - createdAt

groups/
  {groupId}/
    - name
    - icon
    - currency
    - createdBy
    - memberIds[]
    - members[]
    - createdAt

expenses/
  {expenseId}/
    - title
    - amount
    - currency
    - category
    - groupId
    - paidBy
    - participants[]
    - splits{}
    - date
    - isSettlement

invitations/
  {invitationId}/
    - groupId
    - fromUserId
    - toUserId
    - status (pending/accepted/declined)
    - createdAt
    - expiresAt

notifications/
  {notificationId}/
    - userId
    - type
    - title
    - message
    - data{}
    - read
    - createdAt

connections/
  {userId}/
    connectedUsers/
      {connectedUserId}/
        - name
        - email
        - photoURL
        - sharedGroups[]
        - lastGroupTogether
        - connectedAt
```

### Payment Method Configuration

#### PayPal
```javascript
// No API key required for payment links
const paypalUrl = `https://www.paypal.com/paypalme/${username}/${amount}EUR`;
```

#### Revolut
```javascript
// Username-based payment links
const revolutUrl = `https://revolut.me/${username}`;
```

#### SEPA
```javascript
// IBAN validation and manual bank transfer
const ibanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/;
```



## Usage

### Login and Account Set up

1. **Register/Login**: Create an account or sign in with Google
2. **Add Payment Methods** (Needed for settlement): Go to Profile (You) → Add a payment method
3. **Enable biometric authentication**: (Needed for security): Go to Settings → toggle on and set up biometric 
4. **Add Phone Number** (Optional): Go to Profile → Add phone for contact sync

### Creating Your First Group

1. **Create Group**: Dashboard → "+" button → Enter group details
2. **Invite Members**:
   - Quick Add from previous connections
   - Find via contacts (mobile only)
   - Share invite link
   - Show QR code
3. **View group details**: Allow members to join and view the group details

### Adding an Expense

1. Open group → "Add Expense" button
2. Scan receipt/Enter expense details:
   - Title (e.g., "Dinner at Restaurant")
   - Amount (validated based on payment method)
   - Category (Food, Transport, etc.)
   - Date
   - Payer (who paid upfront)
3. Select participants
4. Choose split method:
   - **Equal**: Auto-divides among selected members
   - **Percentage**: Set custom percentages (totals 100%)
   - **Exact**: Specify exact amounts
   - **Shares**: Ratio-based splitting
5. Submit → Notifications sent automatically

### Settling Up

1. Open group → View settlement suggestions
2. Click on a suggested payment
3. Choose payment method:
   - **PayPal**: Opens PayPal.me link with amount
   - **Revolut**: Opens Revolut payment link
   - **SEPA**: Shows IBAN and reference
   - **Manual**: Mark as paid directly
4. **Biometric Confirmation**: Scan fingerprint/face for amounts over €50
5. Mark as "Payment Sent"
6. Other person marks as "Payment Received"
7. Balance automatically updated

### Contact Sync (Mobile Only)

1. Go to Profile → "Add Phone Number"
2. Enter phone with country code (e.g., +353871234567)
3. Create group → "Find Friends via Contacts"
4. Grant contacts permission
5. Select matched friends
6. Invite instantly (no link needed!)



## Security & Privacy

### Authentication & Authorization
- Firebase Authentication with secure session management
- WebAuthn biometric authentication for sensitive operations
- Configurable auto-logout (5-30 minutes of inactivity)
- Google OAuth 2.0 integration

### Data Protection
- Firestore security rules with role-based access control
- AES-256 encryption at rest
- TLS 1.3 for data in transit
- Input validation and sanitization
- XSS and CSRF protection

### Privacy-Preserving Features
- **Phone Number Hashing**: SHA-256 hashing before storage
- **No Raw Phone Numbers**: Only irreversible hashes stored in database
- **Contact Sync Privacy**: Contacts never sent to server (local hashing)
- **GDPR Compliant**: User data deletion, explicit consent
- **Minimal Data Collection**: Only essential information stored

### Best Practices
- Environment variables for sensitive config
- Firestore security rules restrict data access
- Regular security audits
- No sensitive data in client-side code
- Secure payment link generation


## Project Structure
```
split-sync-app/
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── robots.txt
│   └── icons/
├── src/
│   ├── components/
│   │   ├── AddExpenseModal.jsx
│   │   ├── BottomNav.jsx
│   │   ├── ContactSyncButton.jsx
│   │   ├── CreateGroupModal.jsx
│   │   ├── DarkModeToggle.jsx
│   │   ├── ExpenseDetailsModal.jsx
│   │   ├── InvitationNotification.jsx
│   │   ├── NotificationsDropdown.jsx
│   │   ├── QRCodeModal.jsx
│   │   ├── SettleUpModal.jsx
│   │   └── ... (15+ other components)
│   ├── pages/
│   │   ├── Activity.jsx
│   │   ├── Dashboard.jsx
│   │   ├── GroupDetails.jsx
│   │   ├── Login.jsx
│   │   ├── Profile.jsx
│   │   ├── Register.jsx
│   │   └── Settings.jsx
│   ├── services/
│   │   └── firebase.js
│   ├── stores/
│   │   ├── authStore.js
│   │   └── notificationsStore.js
│   ├── utils/
│   │   ├── balanceCalculator.js
│   │   ├── biometric.js
│   │   ├── contactSyncManager.js
│   │   ├── encryption.js
│   │   ├── invitationSystem.js
│   │   ├── paymentLinks.js
│   │   ├── sepaPayment.js
│   │   └── userConnectionsManager.js
│   ├── contexts/
│   │   └── DarkModeContext.jsx
│   ├── hooks/
│   │   ├── useKeyboardAware.js
│   │   └── useSessionTimeout.js
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── .env
├── .gitignore
├── firestore.rules
├── firebase.json
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```



## Contributing

This is an academic project (Final Year Project) and is not currently accepting external contributions. However, feedback and suggestions are welcome!

### Development Guidelines

1. **Code Style**: Follow React and JavaScript best practices
2. **Commits**: Use conventional commit messages
3. **Testing**: Ensure all features work before committing
4. **Documentation**: Update README for major changes



## Roadmap

### Completed Features
- [x] User authentication (Email, Google OAuth, Biometric)
- [x] Group management and invitations
- [x] Advanced expense splitting (4 methods)
- [x] Real-time notifications system
- [x] Payment integration (PayPal, Revolut, SEPA)
- [x] Session timeout and auto-logout
- [x] Dark mode support
- [x] Contact sync (privacy-preserving)
- [x] Balance calculation and settlement suggestions
- [x] Progressive Web App (PWA)
- [x] Receipt scanning with OCR
- [x] Expense categories analytics
- [x] Export reports (PDF, CSV)

### Planned Features
- [ ] Multi-language support (i18n)
- [ ] Budget tracking and alerts
- [ ] Recurring expenses
- [ ] Split by percentage of income
- [ ] Group chat functionality
- [ ] Expense approval workflow
- [ ] Integration with banking APIs
- [ ] Mobile app (React Native)



## Academic Context

**Split-Sync** is developed as a **Final Year Project (FYP)** for the BSc Software Development program at South East Technological University (SETU) Carlow.

### Project Details
- **Program**: BSc Software Development
- **Institution**: SETU Carlow
- **Academic Year**: 2025/2026
- **Project Type**: Capstone Final Year Project
- **Student Developer**: Emmanuel Abolade
- **Project Supervisor**: Joseph Kehoe

### Objectives
1. Design and implement a full-stack Progressive Web Application
2. Integrate multiple payment APIs and authentication systems
3. Implement privacy-preserving features (contact sync, encryption)
4. Apply modern web development practices and security standards
5. Create comprehensive technical documentation

### Deliverables
- Research document
- Functional Specification document - PWA with core features
- Design document
- Source code with version control (Git)
- Technical documentation/Manual
- User testing and evaluation
- Final presentation and screen cast



## License

This project is licensed under the **Apache License** - see the [LICENSE](LICENSE) file for details.
```
Apache License

Copyright (c) 2026 Split-Sync Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```



## Contact

**Developer**: Emmanuel Abolade  
**Email**: emab.dev@gmail.com  
**Institution**: SETU Carlow  
**Project**: Split-Sync - Smart Expense Management PWA

### Links
- **Live Demo**: [https://splitsync-dev.web.app](https://splitsync-dev.web.app)
- **GitHub**: [https://github.com/EmmanuelAbolade/Split-sync](https://github.com/EmmanuelAbolade/Split-sync)
- **Documentation**: [View Docs](./docs)


[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-11.0.2-orange.svg)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.17-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)




## Acknowledgments

- **SETU Carlow**: Academic support and resources
- **Project Supervisor**: Prof. Joseph Kehoe for Guidance and feedback throughout development
- **Firebase**: Backend infrastructure and real-time database
- **React Community**: Libraries and open-source tools
- **Lucide Icons**: Beautiful icon library
- **Tailwind CSS**: Utility-first CSS framework
- **Claude Anthropic**: Assistance with reasoning and solving problems
- **Netlify**: Feedback web application form
- **Formspree**: Feedback form submission and csv export
- **YouTube**: Video Guide live upload



## Screenshots

*Coming soon - Add screenshots of your app here*
```
#Default Mode
[Login/Register]			[Dashboard]     	[Group Details]     [Add Expense]
[OCR Receipt scanning]     	[Notifications]     [Contact Sync]		[Contact Sync]
[Settle Modal]				[Payment Settings]	[Invite Methods]	[Profile]
[Activity]					[QuickAdd]			[Create Group]		[Settings]



#Dark Mode
[Login/Register]			[Dashboard]     	[Group Details]     [Add Expense]
[OCR Receipt scanning]     	[Notifications]     [Contact Sync]		[Contact Sync]
[Settle Modal]				[Payment Settings]	[Invite Methods]	[Profile]
[Activity]					[QuickAdd]			[Create Group]		[Settings]

```



<div align="center">

**Built with ❤️ by Emmanuel Abolade**

**Split-Sync** © 2026 - Making expense tracking simple and fair

[⬆ Back to Top](#split-sync-)

</div>




## **ALSO CREATE:** `LICENSE` file
```
## License

This project is licensed under the Apache License 2.0 – see the [LICENSE](LICENSE) file for details.
