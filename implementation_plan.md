# Implementation Plan - Order Automation App

## Goal Description

Build a secure, modern Windows desktop application using Electron and React to manage multiple Amazon/Flipkart accounts. The app must ensure session isolation (no cookie leakage between accounts), allow rapid order placement via autofill, and maintain a local database of orders with reporting capabilities.

## User Review Required

> [!IMPORTANT]
> **Data Security**: Credentials will be stored securely on the local machine using Electron's `safeStorage` API (which uses Windows Data Protection API). If the machine is formatted, data is lost unless backed up.
> **Session Persistence**: We will store session cookies locally so users don't have to log in every time.

## Proposed Changes

### Project Initialization [NEW]

- **Scaffold**: Use `electron-vite` (React + TypeScript) for a highly optimized build.
- **Styling**: Configure `Tailwind CSS` with a custom "Premium" theme (Inter font, dark mode by default).

### Core Architecture [NEW]

- **Main Process (`main/`)**:
  - `index.ts`: App lifecycle, window creation.
  - `database.ts`: SQLite connection and helper functions (using `better-sqlite3` or `sqlite3`).
  - `sessionManager.ts`: specialized module to handle Electron `partitions` (this is the key to isolation).
  - `ipcHandlers.ts`: Handle communication between UI and backend.
- **Renderer Process (`renderer/`)**:
  - `App.tsx`: Main router handling.
  - `pages/`: Dashboard, Accounts, BrowserGrid, Reports.
  - `components/`: Reusable UI (Cards, Tables, AddressForms).

### Database Schema (SQLite)

- `accounts`: id, platform (AMZ/FLP), label, username, encrypted_password, profile_id.
- `profiles`: id, active_name, address_json, card_info_encrypted.
- `orders`: id, account_id, platform_order_id, date, status, total_amount, product_name.

### Automation/Browser Logic

- **Isolation strategy**:
  - Use `<webview>` or `BrowserView` with `partition="persists:account_ID"`. This guarantees each account has its own cookie jar.
- **Preload Scripts**:
  - Inject scripts into the webviews to:
    - Detect login forms -> Autofill.
    - Detect checkout forms -> Show "Fill Address" floating button.
    - Scrape Order Confirmation page -> Save to DB.

## Verification Plan

### Automated Tests

- We will largely rely on manual verification due to the nature of interacting with third-party sites (Captcha, etc), but we can write unit tests for the database logic.

### Manual Verification

1.  **Isolation Test**: Log into Amazon Account A in Tab 1. Log into Amazon Account B in Tab 2. Refresh both. Ensure they stay logged in to their respective accounts.
2.  **Encryption Test**: Inspect the SQLite database file to ensure passwords are NOT plaintext.
3.  **Workflow Test**:
    - Add Account.
    - Launch Session.
    - Navigate to a product.
    - Verify "Autofill" works.
    - Simulate "Order Complete" and check "Reports" page.
4.  **Export Test**: Export the Order Report to Excel and verify formatting.
