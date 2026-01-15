# System Update Summary

## 1. Netsafe Automation Fix
- **Issue**: Amount field was not being filled correctly.
- **Fix**: Implemented robust proximity-based detection. The bot now locates the "Go" button first and finds the nearest input field to the left, ensuring reliability even if IDs change.

## 2. Shopsy Compatibility
- **Issue**: Cart commands were redirecting to Flipkart.
- **Fix**: Automation commands (`empty-cart`, `add-to-cart`, `checkout`) now dynamically detect the current domain (`flipkart.com` or `shopsy.in`) to apply the correct logic.

## 3. System Settings & Light Theme
- **Feature**: Added a functional "System Settings" page.
- **Theme**: Implemented a "Light Mode" toggle in Settings. This switches the main application wrapper and the Settings page to a light color scheme.
    - *Note*: Inner pages (Cards, Cart, etc.) retain their specialized dark styling for now.

## 4. Flipkart Bulk Address & GST Automation
- **Feature**: Added a new "Bulk Address & GST Manager" tool in Settings.
- **Usage**:
    1.  Go to **System Settings**.
    2.  Paste your account data in CSV format: `email,password,name,address,city,state,pincode,mobile,gst`.
    3.  Click **Run Automation**.
- **Logic**: The system creates a background session for each account, logs in, navigates to the Address section, and fills the "Add Address" form automatically.

## Files Modified
- `src/preload/browser.ts`: Added robust Netsafe logic and `update-profile-auto` handler.
- `src/renderer/src/AppNew.tsx`: Wired up Settings page and Theme state.
- `src/renderer/src/pages/SettingsPage.tsx`: Created new component for Settings and Bulk Automation.
