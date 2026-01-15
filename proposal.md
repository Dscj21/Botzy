# Order Automation App - Project Proposal

## Executive Summary

A dedicated Windows desktop application designed to streamline the management of multiple Amazon and Flipkart accounts. The application focuses on security, session isolation, and workflow efficiency to enable rapid, semi-automated order placement.

## 🚀 Key Features

### 1. Unlimited Account Management (The Backend)

- **Credential Vault**: Secure, local storage for unlimited Amazon/Flipkart credentials.
- **Encryption**: All sensitive data (passwords) are encrypted at rest using industry-standard AES-256.
- **Profile Linking**: Associate specific delivery addresses and payment profiles with each account.

### 2. "True" Multitasking with Session Isolation

- **Isolated Browser Sessions**: This is the core technical differentiator. Unlike a standard browser, this app will run each account in its own isolated "container" (Partition).
  - _Benefit_: You can have 10 Amazon accounts open simultaneously in different tabs/windows, and Amazon will treat them as completely separate devices/browsers. No more logging in and out.
- **Unified Dashboard**: A "Command Center" view to see all active sessions at a glance.

### 3. Integrated Browser & Automation

- **Split-View Browser**: Open the browser directly within the app window.
- **Smart Autofill Engine**:
  - **Auto-Login**: One-click login using stored credentials.
  - **Form Filler**: Automatically fill shipping addresses and payment details on checkout pages.
- **Hybrid Workflow**: The app handles the tedious data entry; the user (or team) performs the final "Place Order" click to ensure accuracy and bypass simple bot detection.

## 🛠 Technical Architecture

- **Platform**: **Electron** (Windows Desktop App)
  - _Why_: Allows full access to system resources, secure file storage, and advanced browser control.
- **Frontend**: **React.js** + **Tailwind CSS**
  - _Why_: Ensures the "Clean, Modern, and Premium" aesthetic you requested. fast and responsive.
- **Database**: **SQLite** (Local)
  - _Why_: Fast, reliable, SQL-based storage for structured order and account data. No internet dependency for the database itself.

## 📋 Proposed Workflow

1.  **Setup**: Add accounts to the "Vault".
2.  **Initiate**: Select 5 accounts from the list and click "Launch".
3.  **Process**: The app opens 5 tabs. It automatically logs in to each.
4.  **Order**: User navigates to products.
5.  **Checkout**: App detects checkout page and offers "One-Click Fill" for address/payment.
6.  **Track**: App records the Order ID and status in the local database for reporting.

## ❓ Questions for You

1.  **Proxy Needs**: Do you require different IP addresses for each account to prevent bans (Proxies)?
2.  **Order Volume**: Are we talking 10s or 100s of orders per day?
3.  **Team Access**: You mentioned a "team". Does this app need to share data between computers, or will it run independently on each machine? (Currently proposed as a standalone local app).

---

**Status**: Ready to initialize project structure upon approval.
