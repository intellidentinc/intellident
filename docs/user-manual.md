# IntelliDent User Manual

**Application version:** 0.1.0 (package manifest)  
**Application commit:** `3619825c373fb926ea7bb48f15b5b739108a105d`  
**Manual version:** 1.0  
**Prepared:** November 19, 2026 (Asia/Manila)  
**Audience:** Patients, dentists, receptionists, clinic administrators, and super administrators.

This manual describes the repository at the commit above. Procedures were checked against interface source code and relevant server checks. They were not tested in a signed-in, running deployment. The deployed version, actual email delivery, payment availability, and browser compatibility need confirmation.

**How to use this manual:** Read Getting started, then the guide for your role. Bold text identifies interface labels. Source IDs refer to the evidence index in section 15. Screenshot placeholders are editorial requests, not pictures of the application.

## 2. Table of contents

- [3. About IntelliDent](#3-about-intellident)
- [4. Getting started](#4-getting-started)
- [5. Patient guide](#5-patient-guide)
- [6. Dentist guide](#6-dentist-guide)
- [7. Receptionist guide](#7-receptionist-guide)
- [8. Clinic administrator guide](#8-clinic-administrator-guide)
- [9. Super administrator guide](#9-super-administrator-guide)
- [10. AI assistance](#10-ai-assistance)
- [11. Troubleshooting](#11-troubleshooting)
- [12. Privacy and security](#12-privacy-and-security)
- [13. Glossary](#13-glossary)
- [14. Technical appendix: deployment and developer setup](#14-technical-appendix-deployment-and-developer-setup)
- [15. Documentation notes and open questions](#15-documentation-notes-and-open-questions)

## 3. About IntelliDent

IntelliDent brings dental appointments, clinical notes, billing, and clinic administration into one browser-based system. It helps clinics coordinate bookings, keep treatment information together, and track payments. Multiple clinics use the system with clinic-scoped access. Controlled record transfers and patient enrollment in more than one clinic are also implemented.

### Roles and navigation

| Role | Main sidebar destinations | Scope |
|---|---|---|
| Patient | Dashboard; My Schedules; My Dental Records; My Bills; My Profile | Own appointments, bills, and authorized records in the active clinic. |
| Dentist | Dashboard; Schedule; Patient Records; Approved Transfers; My Profile | Assigned schedule, authorized patients, and assigned transfers. |
| Receptionist | Dashboard; Appointments; Patients; Billing; My Profile | Clinic booking, patient registration details, and billing. |
| Clinic administrator | Dashboard; Users; Patients; Services; Appointments; Billing; Settings; Reports; Audit Log; Data Requests; My Profile | Clinic operations and administration. |
| Super administrator | Clinics; Applications; Global Policies | Platform oversight and entry into a selected clinic as administrator. |

An administrator role does not give the dentist's clinical-note workflow. Dentists need a qualifying treatment relationship or active receiving-dentist assignment to access a patient's records. A patient sees only their own information. See section 12 for the limits of record protection.

### Platform and access

The repository contains a Next.js and React web application, documented as deployed on Vercel. Obtain the correct website address from your clinic or system administrator. It is not a native desktop or mobile application. An internet connection is needed for server-backed tasks.

Responsive layouts and a mobile sidebar show intended use on large and small screens. Desktop, tablet, and phone compatibility has not been verified for this manual. **Needs confirmation:** Supported browsers, versions, operating systems, minimum screen size, and accessibility testing. No official support matrix was found.

### Terms used in procedures

A **clinic** is the organization whose information you are currently viewing. A **record** contains a clinical entry such as treatment notes. An **appointment** is a booking and has its own status. A **bill** tracks charges and payments. An **OTP** is a one-time verification code sent by email. The glossary in section 13 explains other terms.

*Sources: S01, S02, S05, S14.*

## 4. Getting started

### 4.1 Register a patient account

**Who can do this:** Patient applicant  
**Before you begin:** Access to your email and the correct clinic name.

1. Open **Sign Up** from the sign-in page and select **Join a Clinic**.
2. Enter **First Name**, **Last Name**, **Email Address**, and the other requested personal details. Choose the correct **Clinic**. Enter the required **Mobile Number** in the displayed Philippine number format. Complete the address fields as applicable.
3. Enter **Password** and **Confirm Password**. The form requires at least eight characters, including uppercase and lowercase letters, a number, and a special character.
4. Open and read the terms and privacy text. Scroll to the end, select **I Understand**, and complete the acceptance checkbox.
5. Select **Create Account**. When **Check your inbox** appears, open the verification email and follow its activation link.
6. Return to **Sign In** after verification.

**Expected result:** The account is activated after successful verification. Verification does not automatically sign you in.  
**If it does not work:** See 11.1 for missing email. Staff accounts are created by an administrator; do not register a patient account to obtain staff access.

*Source: S03.*

### 4.2 Sign in and complete email verification

**Who can do this:** All registered roles  
**Before you begin:** An active account, its password, and access to its email inbox.

1. Open **Sign In**. Enter **Email Address** and **Password**, then select **Sign In**.
2. When **Check your email** appears, enter the complete six-digit code from the sign-in email. Select **Verify & Sign In**. The displayed code lifetime is ten minutes.
3. If terms acceptance is required, read the displayed terms and select **Accept & Continue**. If a first-login or expired-password change is required, follow 4.3 before continuing.
4. Check the clinic name and your available sidebar destinations on the resulting screen.

**Expected result:** Regular users reach their clinic area; super administrators reach the Super Admin Portal. Available pages depend on the account role.  
**If it does not work:** If the verification page was refreshed or the challenge expired, return to sign-in and start again. See 11.1–11.3.

*Source: S03, S12.*

The temporary sign-in and record-access OTP exception ended on November 17, 2026 at 11:31:29 PM Philippine time. At this manual’s preparation date, the checked code requires OTP again. The actual deployed code still needs confirmation. **Remember Me** does not remove session limits; see section 12.

### 4.3 Change a password when prompted

**Who can do this:** Any account redirected to Change Password  
**Before you begin:** Know the current password, including the temporary password for a newly created account.

1. On **Change Password**, enter **Current Password**.
2. Enter **New Password** and **Confirm New Password**, meeting the displayed rules.
3. Select **Change Password** and follow the resulting sign-in or navigation prompt.

**Expected result:** The application accepts a valid new password and ends the forced-change requirement. Password changes revoke existing sessions.  
**If it does not work:** Correct validation errors. If you do not know the current password, use 4.4. Do not ask another person to enter or disclose their credentials.

*Source: S03, S12.*

### 4.4 Recover a forgotten password

**Who can do this:** Registered account holder  
**Before you begin:** Access to the registered email address. Read the record-access warning below.

1. On **Sign In**, select **Forgot password?**.
2. Enter **Email Address** and select **Send Reset Link**.
3. Open the reset link from the email. Enter **New Password** and **Confirm Password**, then select **Reset Password**.
4. Sign in with the new password. If **Invalid Reset Link** appears, select **Request new link**.

**Expected result:** A valid reset changes the password. The request screen uses a generic response and does not prove that an account exists.  
**If it does not work:** See 11.1 and 11.5. A reset is not a guaranteed way to recover encrypted clinical notes.

*Source: S03, S05, S12.*

**Record-access warning:** Password reset replaces the account’s encryption access. Another authorized reader who can still decrypt a record may need to open it to restore sharing. If no decrypting reader remains, the server cannot recover those notes. A normal password change and a forgotten-password reset are different operations.

### 4.5 Update your profile

**Who can do this:** Patient, dentist, receptionist, or clinic administrator  
**Before you begin:** You are signed in to the clinic area.

1. Open **My Profile**.
2. Update the editable personal fields, such as names, **Mobile Number**, **Birthdate**, and **Gender**.
3. Select **Save Changes**.

**Expected result:** The message **Profile saved** confirms the update. **Username** and **Email** are read-only.  
**If it does not work:** Correct the displayed field errors or contact the clinic administrator. No verified self-service login-email change is available.

*Source: S04, S12.*

### 4.6 Navigate and sign out

**Who can do this:** All signed-in users  
**Before you begin:** A successful sign-in.

1. Use **Dashboard** for your role’s overview and the sidebar to open the relevant task page. On a narrow layout, use the sidebar toggle to reveal navigation.
2. Check the clinic identity before entering or changing information.
3. When finished, select **Sign Out** in the sidebar.

**Expected result:** The selected page opens, or signing out returns you to the sign-in page.  
**If it does not work:** If a page is unavailable, confirm your role with the clinic administrator. Do not assume that an absent menu grants access through a direct address.

*Source: S02.*

[Screenshot needed: Role-based dashboard and sidebar]

Caption: Show a signed-in training account, clinic identity, navigation toggle, and Sign Out. Remove personal information.

## 5. Patient guide

### 5.1 Request an appointment

**Who can do this:** Patient  
**Before you begin:** Correct active clinic and a service offered by that clinic.

1. Open **My Schedules** and select **Book** (tooltip: **Book appointment**).
2. In **Choose Services**, select one or more services, then select **Next →**.
3. In **Select Dentist**, choose an offered dentist or **Any Available**, then select **Next →**.
4. In **Select Time**, choose an available date and a time under **Morning** or **Afternoon**. Optionally enter **Additional notes (optional)**.
5. Review **Booking summary**, then select **Request booking**.
6. If redirected to payment, review and complete the provider checkout as appropriate. Return to **My Schedules** and **My Bills** to check the saved booking and payment state.

**Expected result:** A successful request is saved as **Pending confirmation**. The receptionist must confirm it. A reservation payment does not itself confirm the appointment.  
**If it does not work:** If there are no slots, follow 11.4. If checkout fails, check whether the booking already exists before requesting it again; see 11.6.

*Source: S06, S08.*

Reservation checkout depends on clinic settings and a positive configured fee. Booking code treats checkout creation as best-effort: a booking can exist even if checkout fails. The **Any Available** choice is not a guarantee that a particular dentist is assigned. Staff resolve assignment during confirmation.

### 5.2 View appointments and request a different time

**Who can do this:** Patient  
**Before you begin:** An existing appointment.

1. Open **My Schedules**. Select **Upcoming** or **Past**.
2. Read the appointment card’s date, time, status, dentist, and appointment code.
3. For an eligible pending or confirmed appointment, select **Call to rebook** when shown.
4. Use the **Phone**, **Landline**, or **Email** shown in **Rebook Contact Details** to ask the clinic to change the booking. Recheck your appointments after staff confirm the change.

**Expected result:** The contact dialog supplies clinic contact information. It does not reschedule the appointment or automatically place a call.  
**If it does not work:** If the button is absent, clinic contact details may not be configured. Ask the clinic through your existing contact channel. There is no verified patient date-editing workflow.

*Source: S06.*

### 5.3 Cancel an appointment

**Who can do this:** Patient who owns the booking  
**Before you begin:** The appointment is Pending confirmation or Confirmed.

1. Open **My Schedules** and find the appointment.
2. Select **Cancel**. Check the appointment in the confirmation dialog.
3. Select **Yes, cancel** to cancel, or **Keep it** to leave the booking unchanged.

**Expected result:** Successful cancellation changes the status to **Cancelled**. The dialog says this action cannot be undone.  
**If it does not work:** Contact the clinic if cancellation is unavailable. Cancellation does not establish that a paid fee has been refunded; see 11.6.

*Source: S06, S08.*

### 5.4 View dental records and visit history

**Who can do this:** Patient  
**Before you begin:** Your own account, email access, and account password.

1. Open **My Dental Records**.
2. If asked to verify identity, select **Send Code to My Email**, enter the code, and select **Verify**.
3. If **Unlock your records** appears, enter **Account password** and select **Unlock**.
4. On **Clinical Records**, select **View** for the desired record. Use **Visit History** to view recorded visits.
5. Select **Close** when finished.

**Expected result:** Authorized record details and available notes are displayed. Visit History lists the visits returned by the application.  
**If it does not work:** See 11.5. Patients do not edit clinical entries here; request corrections through 5.7.

*Source: S05.*

### 5.5 Pay a bill and obtain a receipt

**Who can do this:** Patient who owns the bill  
**Before you begin:** An existing bill; online checkout must be operational for online payment.

1. Open **My Bills**. Review **Outstanding Bills**, the amount paid, and the balance.
2. For an outstanding bill with **Pay Now**, select that button. Review the checkout page and use a payment option actually offered there.
3. After checkout, return to **My Bills** and check the bill’s status and payment history.
4. For an eligible paid or partially paid bill, use **View Receipt** to preview it or **Download** to save the PDF.

**Expected result:** The bill reflects payments after confirmation reaches IntelliDent. The receipt controls are available for eligible payment states.  
**If it does not work:** A success banner alone is not proof that the bill has been updated. If the balance is unchanged or a charge is uncertain, ask the clinic to reconcile it before paying again; see 11.6.

*Source: S08.*

The interface and integration reference PayMongo, but live payment methods depend on provider configuration. This manual does not certify any particular wallet, bank, or card as available. A deposit is credited to the service bill at completion only when the clinic’s deposit-credit setting applies.

### 5.6 Read notifications

**Who can do this:** Signed-in clinic users, including patients  
**Before you begin:** Events must have generated notifications for your account.

1. Select the bell labeled **Notifications** in the page header.
2. Read the notification list. Select an unread notification to mark it read.
3. Use **Mark all as read** if you have reviewed the list.

**Expected result:** Unread indicators change after successful marking. Selecting a notification is verified as a read action, not a promise of navigation to its related appointment.  
**If it does not work:** See 11.7. Check My Schedules directly for the current booking state.

*Source: S09.*

Appointment reminders are generated by a scheduled job for confirmed bookings. Default settings are 24 and 2 hours before a visit, but the checked deployment schedule runs daily with broad matching windows. Do not rely on reminders arriving at an exact hour.

### 5.7 Submit and follow a data request

**Who can do this:** Patient  
**Before you begin:** Know which information you want to access, correct, delete, or transfer.

1. Open **My Profile**. Under **Data Rights**, select **Submit a Data Rights Request**.
2. Choose **Request type**: **Access — Request a copy of your personal data**, **Correction — Request correction of inaccurate data**, **Deletion — Request deletion of your personal data**, or **Transfer — Send selected dental records to another clinic**.
3. For a transfer, select **Destination clinic** and at least one entry under **Records to transfer**.
4. Enter **Description (optional)** if needed, then select **Submit Request**.
5. Reopen the dialog to review **Previous Requests**, status, and administrator notes.

**Expected result:** A request is submitted for review. Ordinary requests show Pending, In Review, Resolved, or Rejected. Transfers have additional source-approval, destination-acceptance, and processing states. Submission does not immediately delete, correct, or transfer data.  
**If it does not work:** Contact your clinic administrator if the destination or records are unavailable, or if a decision needs explanation. No response-time promise is established in the repository.

*Source: S04, S10.*

### 5.8 Switch between enrolled clinics

**Who can do this:** Patient with more than one available clinic enrollment  
**Before you begin:** The sidebar shows **Active clinic**.

1. Open the **Active clinic** selector.
2. Choose the intended clinic.
3. Wait for its dashboard to load and check the clinic name before continuing.

**Expected result:** The session changes to the selected clinic. Appointments and billing use that clinic context.  
**If it does not work:** If the selector is missing, multiple enrollments may not be available. Contact the clinic; no independent patient self-enrollment procedure was confirmed.

*Source: S02, S10.*

[Screenshot needed: Patient booking and My Bills]

Caption: Show the three booking stages, Pending confirmation, and a fictional bill with receipt controls. Use separate images for the two screens.

## 6. Dentist guide

### 6.1 View your schedule

**Who can do this:** Dentist  
**Before you begin:** A dentist account with assigned appointments.

1. Open **Schedule**. The page heading is **My Schedule**.
2. Choose the day or week view, use the date navigation arrows, or select **Today**.
3. Select an appointment event to open **Appointment Details**. Review patient, service, date, end time, notes, and status.
4. Select **Close** when finished.

**Expected result:** Your assigned appointments are displayed. The dentist calendar is read-only.  
**If it does not work:** Ask reception to check assignment or make booking changes. Do not use the calendar as a clinical record editor.

*Source: S06.*

### 6.2 Access an authorized patient’s records

**Who can do this:** Dentist with a qualifying treatment relationship or active care assignment  
**Before you begin:** A confirmed/completed appointment with this patient in the clinic, or an active receiving-dentist assignment; email and password access.

1. Open **Patient Records**. Search by name or patient ID and select the patient row.
2. Complete the email verification prompt if it appears: **Send Code to My Email**, code, then **Verify**.
3. If prompted, enter **Account password** in **Unlock your records** and select **Unlock**.
4. Use **Clinical Records** or **Visit History**. For an existing entry, select its **Edit** icon to open its details; use **Cancel** to close without saving.

**Expected result:** The application displays the permitted patient’s entries. Opening a record requires both authorization and usable encryption access.  
**If it does not work:** See 11.5. Administrators can investigate assignments but cannot simply reveal encrypted notes.

*Source: S05.*

### 6.3 Create a treatment record

**Who can do this:** Authorized treating or assigned dentist  
**Before you begin:** The correct patient’s Clinical Records panel is open and unlocked.

1. Select **Add Record**.
2. Enter **Title** and **Clinical Notes**. Check that the patient and treatment details are correct.
3. If needed, select **Add file** under **Attachments** and choose a PDF, JPG, or PNG file within the 5 MB limit.
4. Select **Create record**. Check the success message and the new entry.

**Expected result:** The record is created and clinical notes are encrypted before storage. Attachments upload separately; check for any upload errors.  
**If it does not work:** If an attachment fails after the record saves, reopen the existing entry and check its attachments before creating another record. See 11.5.

*Source: S05.*

### 6.4 Update, archive, review history, or delete an entry

**Who can do this:** Authorized dentist  
**Before you begin:** The correct patient and existing clinical record are selected.

1. Select the entry’s **Edit** icon. Review its contents before changing anything.
2. Update **Title** or **Clinical Notes** as needed. To archive the entry, set **Status** to **Archived**; choose **Active** for an active entry.
3. Use **Add file** for an attachment, or the attachment delete icon to remove one when appropriate. Attachment deletion is a separate action.
4. Select **Save changes** to save edits. Use the **History** tab when reviewing recorded edits.
5. If the entire entry must be deleted, close the editor, select the entry’s **Delete** icon, review the confirmation, and select **Delete**. Otherwise select **Cancel**.

**Expected result:** Successful saves update the entry; history records supported changes. Deletion removes the entry from normal lists. No end-user undelete workflow is confirmed.  
**If it does not work:** Do not overwrite unreadable notes or an entry showing an integrity warning. Contact the clinic administrator for investigation; see 11.5.

*Source: S05.*

### 6.5 Transfer approved records

**Who can do this:** The source dentist assigned to the transfer  
**Before you begin:** The patient requested a transfer, both clinics approved it, and you can decrypt the selected source records.

1. Open **Approved Transfers**. Check the patient, source clinic, destination clinic, selected records, and status.
2. For a **Ready** transfer, select **Transfer approved records**.
3. If an unlock or email-verification dialog appears, complete it. Then select **Transfer approved records** again; closing those prompts does not automatically restart the transfer.
4. Wait for the success message and reloaded transfer status. For **Needs retry**, investigate the error before trying again.

**Expected result:** The transfer encrypts copies for authorized destination readers and copies included attachments. Successful processing shows completion. It does not grant unrestricted access to the other clinic.  
**If it does not work:** Ask the clinic administrators to check approvals and assignments. If a source record cannot decrypt, resolve that access issue first; see 11.5.

*Source: S10.*

[Screenshot needed: Dentist record editor and Approved Transfers]

Caption: Show Title, Clinical Notes, Status, Attachments, History, and a fictional approved transfer. Hide all real clinical details.

## 7. Receptionist guide

Clinic administrators can also perform the booking, patient-registration, and billing tasks in this section. These permissions do not grant clinical-note editing.

### 7.1 Register or correct patient registration details

**Who can do this:** Receptionist or clinic administrator  
**Before you begin:** Confirm the patient’s identity and correct contact details.

1. Open **Patients** and select **Add** (tooltip: **Register patient**).
2. In **Register Walk-in Patient**, enter **First Name**, **Last Name**, **Email Address**, and the requested contact details.
3. Select **Register patient**. The interface states that a temporary password will be emailed to the patient.
4. To correct an existing patient’s editable details, select **Edit patient**, update the fields, and select **Save changes**. Login email is read-only.

**Expected result:** The patient appears in the clinic directory, or an existing patient’s permitted details are updated. The new patient must complete required first-login steps.  
**If it does not work:** If the email already belongs to an account, ask the administrator to investigate enrollment. Do not create a substitute identity or alter the global login email.

*Source: S07, S12.*

### 7.2 Remove a patient from the clinic directory

**Who can do this:** Receptionist or clinic administrator  
**Before you begin:** You have checked the patient and the clinic’s reason for removal.

1. Open **Patients** and locate the correct patient.
2. Select **Delete patient**. Read the confirmation dialog.
3. Select **Delete patient** to proceed or **Cancel** to keep the patient.

**Expected result:** The clinic enrollment is soft-deleted. The implementation also soft-deletes the account when no other active enrollment remains. The dialog provides no undo procedure.  
**If it does not work:** Ask the administrator to investigate mistakes. This is not a substitute for the patient data-rights review process.

*Source: S07.*

### 7.3 Create an appointment

**Who can do this:** Receptionist or clinic administrator  
**Before you begin:** Patient registered; services, hours, and dentist assignments configured.

1. Open **Appointments** and select the control with tooltip **Create appointment**.
2. Search for and select the patient, then select the required service or services. Use **Next →** to move through the form.
3. Choose the dentist or **Any Available**, then select the date and time. Resolve any conflict warning.
4. Enter **Notes** if needed and choose the offered initial status: **Pending** or **Confirmed (walk-in)**.
5. Review the booking and select **Create appointment**.

**Expected result:** A successful save adds the appointment to the clinic calendar/list. The server checks clinic hours, closures, and conflicts.  
**If it does not work:** If no dentists are available, ask the administrator to check Services. If the time is rejected, choose a valid slot; see 11.4.

*Source: S06.*

### 7.4 Confirm a request or update a visit status

**Who can do this:** Receptionist or clinic administrator  
**Before you begin:** The booking exists and you know the correct operational status.

1. Open **Appointments**. Use **Booking Requests** to show pending requests, or use the calendar/list and filters.
2. Open the appointment event or **View / edit** control.
3. Under **Update Status**, choose an offered status. For an unassigned booking being confirmed, select the required dentist.
4. Select **Save changes**. Review **Status History** as needed.

**Expected result:** The status updates and a history entry is created. Confirmed visits can become Completed, Cancelled, or No Show. Completion creates the service bill when needed.  
**If it does not work:** If no dentist is assigned to the service, the administrator must fix Services. A terminal appointment cannot be reopened through this control.

*Source: S06, S08.*

Status guide: **Pending** awaits staff action. **Confirmed** is accepted. **Completed** records a finished appointment. **Cancelled** records a cancellation. **No Show** records a missed appointment. **Rescheduled** marks the original appointment after replacement. Completed, Cancelled, No Show, and Rescheduled are terminal states in the checked status-update code.

### 7.5 Reschedule a confirmed appointment

**Who can do this:** Receptionist or clinic administrator  
**Before you begin:** A confirmed appointment; the new time and any payment implications have been checked.

1. Open the appointment and select **Reschedule**, or use its **Reschedule** control in the list.
2. Check **Current Appointment**. Choose **Dentist**, **New Date**, and **New Time**.
3. Enter **Notes** and **Reason for Rescheduling** if needed. Resolve any conflict message.
4. Select **Reschedule**. Check both the new appointment and the original entry.

**Expected result:** The form first creates a new Confirmed appointment, then marks the original Rescheduled. These are two requests, so partial failure is possible.  
**If it does not work:** If an error appears, check the list before retrying. Multi-service preservation and billing transfer are not established by this form; see the notes in section 15.

*Source: S06.*

### 7.6 Cancel a booking

**Who can do this:** Receptionist or clinic administrator  
**Before you begin:** A pending or confirmed appointment that should be cancelled.

1. Open **Appointments** and select the booking’s **Cancel** control.
2. Check the booking and enter **Reason (optional)** if useful.
3. Select **Cancel appointment**, or **Keep appointment** to stop.

**Expected result:** The appointment becomes Cancelled after a successful request. Notifications are generated according to the implemented event flow and settings.  
**If it does not work:** If a payment already exists, ask the responsible staff member to review it separately. No automatic refund should be assumed.

*Source: S06, S08.*

### 7.7 Record cash received and issue a receipt

**Who can do this:** Receptionist or clinic administrator  
**Before you begin:** An existing bill and a verified cash payment.

1. Open **Billing**. Search by patient or appointment code, filter if needed, and select the bill row.
2. Check **Billing Detail**, **Amount Summary**, and **Payment History**.
3. Select **Record Cash**. Enter **Amount Received (₱)** and optional notes. The amount must be positive and cannot exceed the remaining balance.
4. Select **Record Payment**. Check the updated balance and payment history.
5. Use **View Receipt** or **Download** when available.

**Expected result:** The cash payment is recorded and the bill is recalculated. A partial payment leaves a balance.  
**If it does not work:** Check existing payment history before retrying after an uncertain response. Ask the administrator to reconcile discrepancies; see 11.6.

*Source: S08.*

### 7.8 Open online checkout or export billing data

**Who can do this:** Receptionist or clinic administrator  
**Before you begin:** An existing bill for checkout, or a justified need for a billing export.

1. For checkout, open the bill from **Billing** and select **Payment Link** when available. It opens provider checkout in a new tab.
2. For an export, use the export control on **Billing** and select **Export as CSV** or **Export as PDF**.
3. Check the resulting file or checkout state. Keep exported personal and financial information in an approved restricted location.

**Expected result:** Checkout opens or a billing export is generated. **Payment Link** does not itself email a link or record payment.  
**If it does not work:** If no new tab appears, check the browser’s blocked-window indication. If payment or export fails, ask the clinic administrator to investigate.

*Source: S08.*

For notifications, follow 5.6. Staff actions can generate notifications; no general manual “send reminder now” interface was verified. Administrators control supported event channels and templates in Settings. Actual inbox delivery is not established by a successful booking update.

## 8. Clinic administrator guide

Use the receptionist procedures for clinic appointments, patient registration details, and billing. Super administrators can use these administration screens after entering the clinic.

### 8.1 Create a staff account

**Who can do this:** Clinic administrator; super administrator inside a clinic  
**Before you begin:** Correct staff identity, email, and intended role.

1. Open **Users** and select **Add** (tooltip: **Add user**).
2. Fill in **Add New User**, including names, **Email Address**, optional contact details, and **Role**.
3. Choose **Dentist** or **Receptionist**. Only a super administrator is offered **Administrator** for creation.
4. Select **Create user**. Tell the staff member to follow the welcome email and required first-login password change.

**Expected result:** The staff account is created with a generated temporary password sent by email.  
**If it does not work:** Check the list before retrying. If email delivery fails, involve the system operator; do not send shared passwords.

*Source: S11.*

### 8.2 Change a staff role, access status, or delete an account

**Who can do this:** Clinic administrator; super administrator inside a clinic  
**Before you begin:** You have checked the correct staff account and the effect on access.

1. Open **Users** and locate the staff member.
2. To switch between dentist and receptionist, select **Edit role**, choose **Role**, and select **Save changes**. Other role conversions are not offered by this workflow.
3. To change access, select **Deactivate user** or **Activate user** as appropriate. This control acts without the deletion confirmation dialog.
4. Only if deletion is intended, select **Delete user**, review the dialog, and confirm **Delete user**.

**Expected result:** The selected change is applied. Role and status changes revoke affected sessions. Deleting or deactivating your own account can sign you out.  
**If it does not work:** If a patient appears in Users, use Patients for normal patient administration. The initial Users rendering and API differ; see section 15.

*Source: S11, S12.*

### 8.3 Configure services and dentist assignments

**Who can do this:** Clinic administrator  
**Before you begin:** Dentist accounts exist in the clinic.

1. Open **Services** and select **Add** (tooltip: **Add service**).
2. Enter **Service Name**, **Duration (minutes)**, **Buffer Time (minutes)**, and **Default Price** as appropriate.
3. Choose **Assigned Dentists**. A service without an assigned dentist is labeled **No dentist — not bookable**.
4. Select **Add service**. To change an existing service, use **Edit** and **Save changes**.
5. If a service must be removed, select **Delete**, review the dialog, and select **Delete service**.

**Expected result:** The catalog and assignments are updated. The API accepts durations of 15–240 minutes, buffers of 0–30 minutes, and non-negative prices.  
**If it does not work:** Correct validation errors and check dentist assignments before testing a booking. Do not assume a price change updates existing bills.

*Source: S11.*

### 8.4 Set clinic identity, contact details, and logo

**Who can do this:** Clinic administrator  
**Before you begin:** Accurate clinic details and, if needed, a JPG or PNG logo under 5 MB.

1. Open **Settings** and review **Clinic Profile**.
2. Update the relevant **Clinic Identity**, **Address**, or **Contact Information** section and select **Save Changes**.
3. For the logo, select **Upload Logo** and choose the image. Use **Remove** only if the logo should be removed.

**Expected result:** Clinic details update after successful saving. Configured contact fields can appear in the patient rebooking dialog.  
**If it does not work:** Check form errors and file type/size. If saving fails, contact the system operator.

*Source: S11.*

### 8.5 Set operating hours and closures

**Who can do this:** Clinic administrator  
**Before you begin:** The intended clinic schedule and holiday/closure dates.

1. Open **Settings**, then **Operating Hours**. Select **Working Days**, **Opening Time**, and **Closing Time**.
2. Select **Save Hours**. To store a reusable pattern, select **Save as Preset**, enter **Preset Name**, then **Save Preset**.
3. To reuse a preset, select its **Apply** control, check the displayed values, then select **Save Hours**.
4. Under **Clinic Closures**, choose **Date**, enter **Reason (optional)**, and select **Add**. Use a closure row’s delete icon only to remove that closure.

**Expected result:** Hours or closure dates are saved and used in booking validation. Applying a preset fills the form; Save Hours commits the hours.  
**If it does not work:** Check existing appointments separately. No automatic rescheduling of existing appointments after an hours change is established.

*Source: S11, S06.*

### 8.6 Configure online payments and deposits

**Who can do this:** Clinic administrator  
**Before you begin:** The operator has configured the payment integration; clinic fee policy is known.

1. Open **Settings** and **Payment Settings**.
2. Set **Enable PayMongo Online Payments** as intended.
3. Set **Charge reservation fee at booking**, **Reservation Fee Amount (₱)**, and **Credit deposit toward service bill** as appropriate.
4. Select **Save Payment Settings**.

**Expected result:** Saved settings govern reservation-fee behavior and deposit credit. Configuration alone does not verify live provider availability.  
**If it does not work:** Ask the operator to verify provider configuration and callback delivery. See 11.6 and the checkout-setting caveat in section 15.

*Source: S11, S08.*

### 8.7 Review reports and export results

**Who can do this:** Clinic administrator  
**Before you begin:** A reporting period and a justified need to access or export the data.

1. Open **Reports**. Choose **Appointments**, **Revenue**, or **Patients**.
2. Set **From** and **To**. Apply **Service** or **Dentist** filters where displayed; use **Clear** to reset filters.
3. Review the summary and detail shown for the selected report.
4. Use the export control and choose **Export as CSV** or **Export as PDF**. If **Re-enter your password** appears, enter **Password** and select **Verify**.

**Expected result:** The selected report is displayed and the requested export is generated after required verification.  
**If it does not work:** Check filters and your current session. If export fails, see 11.8. Store the file with restricted access.

*Source: S11, S12.*

### 8.8 Review and export audit logs

**Who can do this:** Clinic administrator  
**Before you begin:** You are investigating a specific clinic activity or access event.

1. Open **Audit Log**.
2. Use the search field, **Entity type**, **From**, **To**, and **Action** filters. Use **Clear all** to reset.
3. Expand an entry that has detail to review the available event information.
4. If needed, use **Export as CSV** or **Export as PDF** and complete **Re-enter your password** with **Verify**.

**Expected result:** Matching logged events or an export are shown. An audit log is a record of implemented logging, not a guarantee that every possible event was captured.  
**If it does not work:** Check filters and retention settings, then ask the operator to investigate missing events.

*Source: S11, S12.*

### 8.9 Set password and session policies

**Who can do this:** Clinic administrator  
**Before you begin:** The intended policy has been agreed for the clinic.

1. Open **Settings**, then **Password Policy**.
2. Set **Enable periodic password expiry**. If enabled, choose **Expire passwords every (days)** and **Apply to roles**. The form accepts 30–365 days and requires at least one selected role.
3. Select **Save Password Policy**.
4. Set **Enforce single active session per user** if required, then select **Save Session Policy**.

**Expected result:** The selected role/expiry policy is saved. Single-session mode ends other active sessions when a user signs in again.  
**If it does not work:** Correct field errors. Do not rely on the older “Admin accounts” description: the current form supports selecting several clinic roles.

*Source: S11, S12.*

### 8.10 Configure notifications and retention

**Who can do this:** Clinic administrator  
**Before you begin:** Know the clinic’s approved communication and retention settings. Retention changes can lead to permanent removal.

1. In **Settings**, open **Notification Settings**. Set **First reminder (hours before)** and **Second reminder (hours before)**.
2. Under **Notification Types**, set the event delivery channels. Select an event row to edit its email subject/body using the displayed template variables. Use **Reset to default** when needed.
3. Select **Save Notification Settings**.
4. Under **Audit Log Retention**, choose **Auto-purge audit logs older than**, then **Save Retention Policy**.
5. Under **Data Retention**, choose **Auto-purge patient records older than** and **Auto-purge billing records older than**, then **Save Retention Policy**.

**Expected result:** Settings are saved. Scheduled jobs perform the configured purges; patient-record and billing retention concern eligible soft-deleted data.  
**If it does not work:** Ask the operator to verify scheduled-job execution. The interface’s attachment-cleanup note conflicts with current purge code; see section 15.

*Source: S11, S09, S12.*

### 8.11 Review ordinary patient data requests

**Who can do this:** Clinic administrator  
**Before you begin:** A patient request exists in the current clinic.

1. Open **Data Requests** and **Source requests**. Filter by **Type** or **Status** if needed.
2. Select **Review** for the request and read the patient’s description.
3. For an access, correction, or deletion request, choose the appropriate **Status**, add notes for the patient, and select **Save**.

**Expected result:** The request’s tracking status and administrator notes update. Marking Resolved is not an automatic export, correction, or deletion operation.  
**If it does not work:** Follow the clinic’s verified fulfillment process. That operational process and response times need confirmation; do not mark a request resolved merely to clear it.

*Source: S10.*

### 8.12 Review a record transfer

**Who can do this:** Source-clinic or destination-clinic administrator  
**Before you begin:** A patient-requested transfer with listed records; appropriate dentists available.

1. For source review, open **Data Requests**, choose **Source requests**, and select **Review** for the transfer. Check the records and destination.
2. Choose **Dentist who will transfer the records**, enter notes as needed, and select **Approve transfer**; use **Deny** if the request should not proceed.
3. For destination review, use **Incoming transfers**. Select **Review** for the transfer, choose **Receiving dentist**, and select **Accept transfer**, or **Reject**.
4. After both approvals, have the assigned source dentist use **Approved Transfers** as described in 6.5.

**Expected result:** Approval by both clinics makes the transfer ready for the source dentist. Administrators approve and assign; the dentist performs the encrypted-record transfer.  
**If it does not work:** If no eligible dentist appears, investigate account and record-access setup. Do not send clinical notes through an unrelated channel to bypass the transfer workflow.

*Source: S10.*

[Screenshot needed: Clinic Settings and Data Requests]

Caption: Show role-selectable password expiry and transfer review controls using fictional clinic and patient data.

## 9. Super administrator guide

### 9.1 Review clinic applications

**Who can do this:** Super administrator  
**Before you begin:** A submitted clinic application.

1. Open **Applications** in the Super Admin Portal. Use the offered status filter and open the application row.
2. Review **Business Information**, **Contact Person**, services, and **Submitted Documents**.
3. Select **Approve** to approve a pending application. For rejection, select **Reject**, enter **Reason (optional)**, then **Confirm Rejection**.

**Expected result:** Approval creates the clinic and initiates an approval email. Rejection records the decision and initiates an email with the optional reason. Already processed applications cannot be processed again.  
**If it does not work:** If a response is uncertain, refresh the application list before attempting another decision. Email acceptance does not prove inbox delivery.

*Source: S13.*

Clinic applicants use **Sign Up → Register a Clinic**. The application form collects business/contact details, proposed services, supporting documents, and terms acceptance. It offers **Next**, **Back**, and **Submit Application**. **Needs confirmation:** The complete hosted applicant-to-first-administrator handoff should be tested before publishing a separate onboarding guide; approval should not be described as automatically creating a usable administrator login.

### 9.2 Create or edit a clinic and control its availability

**Who can do this:** Super administrator  
**Before you begin:** Correct clinic identity and authorization to change platform access.

1. Open **Clinics**. Select **Create Clinic**, fill **Clinic Name**, **Address**, and **Phone**, then select **Create**.
2. To edit an existing clinic, select **Edit clinic**, change its details, and select **Save Changes**.
3. To suspend or restore access, select **Disable clinic** or **Enable clinic** on the card, read the confirmation, and select **Disable** or **Enable**.
4. Only when deletion is intended, select **Delete clinic**, review the dialog, and confirm **Delete Clinic**.

**Expected result:** The selected clinic change is saved. Disabling blocks regular clinic users until re-enabled. Deletion is a separate action and has no verified user undo procedure.  
**If it does not work:** Check the clinic card before retrying. Escalate access or accidental-deletion problems to the responsible system operator.

*Source: S13.*

### 9.3 Enter a clinic and review its administration

**Who can do this:** Super administrator  
**Before you begin:** The intended clinic is listed.

1. On **Clinics**, select **Enter as Admin** for the correct clinic.
2. Check the clinic identity, then use the relevant administrator procedures in section 8. For a first clinic administrator, use **Users → Add** and the **Administrator** role option.
3. Select **Back to Super Admin** when finished.

**Expected result:** The session enters or exits the chosen clinic’s administration context. This does not create a dentist profile or grant the clinical-note editing workflow.  
**If it does not work:** Check the selected clinic and session. Ask the system operator to investigate failures rather than editing data directly.

*Source: S13, S11.*

### 9.4 Apply global policies

**Who can do this:** Super administrator  
**Before you begin:** The policy is intended for all clinics; affected clinics have been considered.

1. Open **Global Policies** and review **Current Policy Status Across Clinics**.
2. Configure the intended section: **Security Policies**, **Appointment Reminders**, **Audit Log Retention**, **Patient Record Retention**, or **Billing Record Retention**.
3. Select that section’s **Apply to All Clinics**.
4. Read the confirmation and select **Confirm**, or **Cancel** to stop.

**Expected result:** The selected policy category is applied across clinics. This can replace clinic-specific values.  
**If it does not work:** Review the success/error message and current-policy table. Involve the system operator if the result is incomplete.

*Source: S13.*

Platform oversight consists of Clinics, Applications, and Global Policies in the checked sidebar. No separate consolidated platform financial-report screen was verified. Enter the appropriate clinic to use its Reports and Audit Log.

### 9.5 Export a clinic backup

**Who can do this:** Super administrator  
**Before you begin:** A restricted location for the sensitive backup and a justified backup purpose.

1. Open **Clinics** and select **Backup** on the intended clinic card.
2. If prompted, enter your current **Password** in **Re-enter your password**, then select **Verify**.
3. Check that the JSON download completes and store it in the restricted backup location.

**Expected result:** The application exports operational clinic data. The backup excludes clinical PatientRecord notes and RecordKey envelopes. It is not a complete clinical-record backup.  
**If it does not work:** If backup fails, check the session and ask the system operator to investigate. Do not treat an empty or failed download as a valid recovery copy.

*Source: S13, S12.*

Backup files contain sensitive account and patient information, including password hashes and encrypted key material. Restrict access and protect backups at rest as required by the repository’s security guidance. Do not attach them to ordinary support messages.

### 9.6 Restore an application backup

**Who can do this:** Super administrator  
**Before you begin:** A matching-clinic IntelliDent JSON backup, at most 25 MB; a reviewed recovery purpose; email and password access. This task writes database data.

1. Open **Clinics** and select **Restore** on the correct clinic card. Complete password verification if requested.
2. Select **Select backup .json**. Check the displayed clinic match and backup information. Use **Change** if the wrong file was chosen.
3. Enter **Reason for restore** and, if useful, **Snapshot / source reference (optional)**.
4. Select **Send Verification Code**. Read the email, then enter **Verification code**.
5. Only when ready to import the backup, select **Run Restore**.
6. Review the resulting summary, including skipped entries, and select **Done**. Check affected operational data afterward.

**Expected result:** The application imports validated matching-clinic data and records the restore. It does not restore excluded clinical notes, and backup audit entries are not re-imported.  
**If it does not work:** If an error or uncertain response occurs, investigate the current state with the system operator before another restore. Do not alter the backup’s clinic identity to force acceptance.

*Source: S13, S12.*

Neon point-in-time database recovery is a separate hosting/operator task. The in-app **Run Restore** is not merely authorization for Neon recovery. Provider recovery instructions, storage recovery, and a complete disaster-recovery test are **Needs confirmation**; see section 14.

[Screenshot needed: Super administrator restore form]

Caption: Show the backup selection, reason, verification stage, and fictional completion summary. Hide codes, tokens, and real backup contents.

## 10. AI assistance

### 10.1 Ask the assistant about system information

**Who can do this:** Signed-in clinic roles with the assistant control  
**Before you begin:** The AI service is configured and reachable.

1. Select **IntelliDent AI Assistant**.
2. Enter a question in **Ask me anything...**. Press Enter to send; Shift+Enter adds a new line.
3. Read the response and check appointment or clinic details against their relevant system screens.
4. Use **New chat** or **New Chat** to start another conversation. Select a conversation under **Chat History** to reopen it; its **Delete** control removes that conversation.

**Expected result:** The assistant responds using role-aware information tools when available. The inspected tools retrieve information; ordinary forms remain the verified route for booking and status changes.  
**If it does not work:** If AI fails, continue with the normal system pages. Ask clinic staff about unresolved operational questions.

*Source: S14.*

### 10.2 Use suggested slots and review no-show indicators

**Who can do this:** Patient for booking suggestions; receptionist or administrator for staff suggestions and risk indicators  
**Before you begin:** Service, dentist preference, and date selected in the booking form.

1. In patient booking, select **AI Pick**. In staff booking, use **Get suggestions** under **AI Suggested Slots**.
2. Review the suggestions and select a proposed time if suitable.
3. Complete the normal booking review and submission steps. A suggestion alone does not reserve a slot.
4. For staff, review a high no-show-risk indicator when displayed in appointment creation/details and any **Recommended Actions**.

**Expected result:** A suggestion fills a time selection; the booking still requires normal validation and confirmation. A risk indicator is advisory and may not appear.  
**If it does not work:** Use ordinary available slots when suggestions are unavailable. Do not change an appointment solely because of a risk label without checking the circumstances.

*Source: S14, S06.*

The application terms describe IntelliDent as a scheduling and record-keeping tool that does not replace professional judgment. Do not treat chatbot output as a diagnosis or treatment instruction. The AI prompt itself says suggestions are recommendations and staff must confirm changes. Clinical questions belong with the treating dentist. No claim of clinical validation is made here.

## 11. Troubleshooting

Use the clinic’s established contact details for appointment, record, and billing questions. Clinic staff should escalate technical failures to their administrator or system operator. A support address appears in the sidebar, but its monitoring and response times have not been verified. Never include passwords, OTPs, backup files, or unnecessary clinical details in a support request.

### 11.1 Verification or reset email does not arrive

**Who can do this:** Account holder; administrator/operator for delivery investigation  
**Before you begin:** You requested an email from the correct IntelliDent screen.

1. Check the destination address shown by the application and look in spam/junk folders.
2. For a record-access code, use **Didn’t receive a code? Resend** when the cooldown allows it. For sign-in OTP, return to sign-in and start again if the challenge expired.
3. For an expired reset link, use **Request new link**. Do not guess verification codes repeatedly.
4. If still unresolved, ask the clinic administrator to have the operator check email delivery configuration.

**Expected result:** A current link or code lets you continue the associated task. Delivery remains dependent on the configured mail service.  
**If it does not work:** The operator should check the documented Gmail SMTP configuration and delivery to a controlled inbox. No universal resend-registration control or guaranteed delivery interval is established.

*Source: S03, S05, S12, S15.*

### 11.2 Forgotten password

**Who can do this:** Account holder  
**Before you begin:** Access to the registered mailbox.

1. Follow **Forgot password? → Send Reset Link** as described in 4.4.
2. Use the latest valid reset link and sign in with the new password.
3. If encrypted notes are unavailable afterward, follow 11.5 instead of repeatedly resetting the password.

**Expected result:** Account login can be restored by a successful reset, subject to active-account rules.  
**If it does not work:** If mailbox access is lost, contact the clinic administrator. No verified self-service email replacement or manual recovery procedure is documented.

*Source: S03, S12.*

### 11.3 Account is locked or sign-in is refused

**Who can do this:** Account holder  
**Before you begin:** Read the exact sign-in message.

1. If the message reports a temporary lock, stop repeated password attempts and wait for the stated lock interval.
2. After the interval, use the correct password or the password-reset procedure.
3. If the account or clinic is inactive, ask the clinic administrator to check access status.

**Expected result:** A temporary lock can expire; an inactive account/clinic needs authorized administrative action.  
**If it does not work:** Defaults are five failed attempts within five minutes and a fifteen-minute lock, but deployment configuration can change them. Escalate persistent refusal to the operator; there is no verified “unlock account” button.

*Source: S12.*

### 11.4 No appointment slots are available

**Who can do this:** Patient or booking staff  
**Before you begin:** The booking form is open.

1. Check that the service and dentist choices are populated.
2. Try another offered date or dentist. Observe disabled dates and conflict messages.
3. Ask reception to check availability. Staff should ask an administrator to verify **Assigned Dentists**, **Operating Hours**, and **Clinic Closures**.

**Expected result:** A valid available slot becomes selectable when the clinic configuration and availability permit it.  
**If it does not work:** A slot may be taken before submission. If the server reports a conflict, select another time. Do not bypass closure or conflict rules by entering a fabricated date.

*Source: S06, S11.*

### 11.5 A dental record cannot be accessed or unlocked

**Who can do this:** Patient owner or authorized dentist  
**Before you begin:** Read whether the error concerns authorization, email verification, unlocking, sharing, or integrity.

1. Complete the record-access email verification if requested.
2. For missing in-memory keys after a reload, select **Unlock records** or use the displayed **Unlock your records** prompt. Enter your current **Account password** and select **Unlock**.
3. If the application specifically says keys could not be loaded and asks you to sign in again, sign out and sign in again.
4. If access still fails, have the clinic check the dentist relationship/assignment. After password reset or a new dentist assignment, another authorized reader who can decrypt the record may need to open it to refresh sharing.
5. For **Integrity check failed** or a corruption warning, stop editing the entry and report the record reference and error to the clinic administrator.

**Expected result:** Usable authorized keys allow notes to display. Opening by an existing reader can restore missing sharing in supported cases.  
**If it does not work:** Recovery is not guaranteed. If no authorized reader can decrypt the notes, the server cannot reconstruct them. Never overwrite unreadable clinical notes as a repair attempt.

*Source: S05, S12.*

### 11.6 Payment is unsuccessful or the balance is unchanged

**Who can do this:** Patient or billing staff  
**Before you begin:** Have the appointment/bill reference and the provider’s payment result, without disclosing financial credentials.

1. Reopen **My Bills** or **Billing** and inspect the balance and payment history.
2. If the provider reports a charge but IntelliDent has not updated, ask billing staff to reconcile the transaction before paying again.
3. If the payment failed without a charge, use the offered checkout again only after checking the bill, or arrange payment with reception.
4. For cancelled or rescheduled visits with payments, ask the clinic to review the charge and its refund handling separately.

**Expected result:** Confirmed payments are reconciled to the correct bill, or the clinic identifies the next payment step.  
**If it does not work:** Staff should ask the operator to check provider confirmation delivery. No verified user-facing refund button or automatic cancellation refund is available in the reviewed interface.

*Source: S08.*

### 11.7 Notifications or reminders are missing

**Who can do this:** Clinic user; administrator for settings  
**Before you begin:** A relevant event or confirmed appointment exists.

1. Open **Notifications** and check the list; also check the appointment directly.
2. Check the registered email inbox and spam folder for email notifications.
3. Ask the administrator to inspect **Notification Settings**, enabled channels, and reminder intervals.
4. If still missing, the administrator should ask the operator to check the reminder job and mail delivery.

**Expected result:** The current appointment state remains available even when a notification is delayed or absent.  
**If it does not work:** Daily reminder scheduling does not guarantee exact-hour delivery. No manual resend-all-notifications workflow was verified.

*Source: S09.*

### 11.8 Session expires, a page is unavailable, or an export fails

**Who can do this:** Signed-in user with the required role  
**Before you begin:** Note the screen and error without collecting sensitive data.

1. If redirected to sign-in, sign in again and reopen the task page.
2. For an export verification prompt, enter the current password and select **Verify**.
3. Check your role and clinic context. Ask an administrator to investigate an unexpected permission error.
4. Before repeating a save after an uncertain response, check whether the change already appears.

**Expected result:** A valid session restores authorized access; successful password verification allows the protected export.  
**If it does not work:** Send the administrator the page name, time, and non-sensitive error text. Hosted availability and response procedures need local confirmation.

*Source: S02, S11, S12.*

## 12. Privacy and security

The repository implements session checks, role checks, and clinic-scoped queries. Patient records add a treatment/assignment check and email verification. These are implementation findings, not a claim of independent security certification or flawless deployment.

Clinical **notes** are encrypted in the browser and stored as ciphertext with wrapped access keys. Titles, registration information, appointment details, billing, and attachments must not be described as all having the same protection. Attachments use private storage and temporary access links; they are not end-to-end encrypted. An administrator cannot simply recover unreadable notes from the database.

Decrypted record keys live in browser memory and are cleared on sign-out or a full reload. This explains the password-unlock prompt. Password reset can remove access to old encrypted notes; see 4.4 and 11.5.

The current security documentation and session implementation use server-side idle expiry (normally ten minutes), with Remember Me changing the idle allowance, subject to an eight-hour absolute cap. A separate browser inactivity mechanism is also present. Do not rely on an older “30-minute logout” or “three-day login” description as a guaranteed usable session length. Single-session policy can also end access on other devices.

Use your own account. Keep passwords and email codes private. Check the patient and clinic before saving information. Use Sign Out when finished. Limit downloads to what is needed and restrict access to exported files. For screenshots used in training or support, use fictional data or remove personal details. Report unexpected access, integrity warnings, and suspicious account activity through the clinic’s established channel.

Retention can permanently purge eligible information. “Soft-deleted” does not mean retained forever. Backup exports are sensitive and incomplete for clinical recovery. See 8.10 and 9.5–9.6.

*Sources: S05, S12, S13.*

## 13. Glossary

| Term | Meaning |
|---|---|
| Active clinic | The clinic selected for the current session. |
| Administrator | User responsible for clinic settings and administration. |
| Appointment code | Reference identifying a booking. |
| Audit log | Recorded system activity used for review. |
| Balance | Amount still due on a bill. |
| Buffer time | Extra scheduled time associated with a service. |
| Clinical notes | Dentist-entered observations and treatment details. |
| CSV | A tabular text export commonly opened in spreadsheet software. |
| Encrypted notes | Notes transformed into unreadable data until an authorized browser unlocks them. |
| OTP | One-time password/code sent by email for a verification step. |
| Partial payment | Payment that leaves an outstanding balance. |
| PDF | A document format used for receipts, reports, and this manual. |
| Record transfer | A patient-requested, approved copy of selected records to another clinic. |
| Reservation fee/deposit | Upfront booking charge when configured; credit toward the service bill depends on settings. |
| Role | Account category that determines available tasks. |
| Session | The period of authenticated access, subject to expiry and revocation. |
| Soft delete | Removal from normal active lists, with stored data retained until applicable purge rules act. |
| Step-up verification | Additional identity verification before a protected action. |
| Super administrator | Platform-level operator who oversees clinics and global policies. |
| Terminal status | Appointment state that cannot be changed through the ordinary status-update flow. |
| Webhook | Provider-to-application notification, such as payment confirmation. |

## 14. Technical appendix: deployment and developer setup

This appendix is for developers and authorized hosting operators. Patients and clinic staff do not need these tools. It describes repository setup, not a verified production migration or disaster-recovery runbook. Do not use real patient data in demonstrations.

### 14.1 Prepare a local development environment

**Who can do this:** Developer  
**Before you begin:** Repository access, Node.js 22.12 or newer for the documented lint tooling, npm, an isolated development database, and authorized configuration values.

1. Obtain the intended repository checkout and record its commit. Use the committed package manifest and lockfile together.
2. Run `npm ci` in the repository root.
3. Create the local `.env` using the environment-variable documentation in `CLAUDE.md` and `README.md`. Configure database and session settings; configure mail, storage, payment, AI, and scheduled-job settings only for integrations you are testing. Keep all actual values private.
4. Run `npx prisma generate`. For the documented local schema-sync workflow, run `npx prisma db push` against the isolated development database only.
5. If sample data is required, follow the guarded demo-seed documentation: explicitly enable demo seeding and supply a unique compliant seed password before `npx prisma db seed`. Do not seed production.
6. Run `npm run dev` and use the local address reported by Next.js.

**Expected result:** The local application starts if its dependencies, database, and required configuration are valid.  
**If it does not work:** Review console errors without sharing secrets. Resolve database and integration configuration with the responsible operator. This manual did not run or validate local application setup.

*Source: S15.*

### 14.2 Prepare deployment and maintenance checks

**Who can do this:** Authorized developer or hosting operator  
**Before you begin:** A staging environment, controlled test accounts, and a reviewed deployment change.

1. Follow the repository’s documented Vercel, Neon/PostgreSQL, Supabase storage, Gmail SMTP, PayMongo, and AI configuration. Provision values through the appropriate protected environment settings.
2. Run `npm run lint`, `npm run test:security`, `npm audit`, `npm audit --omit=dev`, and `npm run build` for the intended change.
3. Check private storage configuration for clinic documents and record attachments. Verify mail delivery with a controlled inbox and payment confirmation in an appropriate test environment.
4. Validate role and clinic boundaries, sign-in/OTP, record access after password changes/reset, and the workflows required by the deployment in staging.
5. Deploy the reviewed application and lockfile together. Verify configured scheduled jobs and the hosted application version after deployment.

**Expected result:** The operator has check results and staging evidence for the intended release. A build or dependency audit alone does not validate the deployed user workflows.  
**If it does not work:** Investigate failures before release. Provider administration and production database changes require the project’s operational process; a fully verified production runbook is Needs confirmation.

*Source: S12, S15.*

**Developer-only bootstrap:** The README documents `node prisma/seed-super.js` for intentional super-administrator bootstrap. It requires explicit bootstrap enablement and an operator-supplied password meeting the documented stronger bootstrap policy. Never publish the password or seed outputs. Existing/default credentials must not be treated as supported login instructions.

**Hosting-provider recovery:** Neon point-in-time recovery, independent storage recovery, and full clinical disaster recovery require operator procedures. No complete verified runbook was established. In-app JSON restore is the separate writing operation described in 9.6.

**Reminder maintenance:** `vercel.json` schedules reminders daily at 08:00 UTC. Current reminder code uses broad windows and per-clinic intervals. Verify actual hosting execution rather than assuming settings alone send reminders.

## 15. Documentation notes and open questions

### 15.1 Evidence and verification scope

The working tree was clean before documentation work. The manual records package version 0.1.0 and the exact application commit on its cover. No release tag or hosted deployment was asserted. Review consisted of repository documentation, interface components, related handlers/helpers, and schema inspection. `docs/schema.pdf` was reviewed by extracting its text; it is historical data-model documentation, not a source of interface procedures.

Source IDs below identify the evidence used by each procedure. Paths are relative to the repository root. Interface evidence was used for navigation and labels; server code was used to check access and outcomes. The source index is also a maintenance map for future revisions.

| ID | Reviewed sources and scope |
|---|---|
| S01 | `docs/features.md`; `docs/defense/01-architecture.md`; `package.json`; `prisma/schema.prisma`; `docs/schema.pdf`. Product, platform, feature discovery, and data-model context. |
| S02 | `app/modules/dashboard-page/AppSidebar.jsx`, role dashboards, `SignOutButton.jsx`, `ExitSuperAdminButton.jsx`; `components/commons/PageHeader.jsx`; `components/ui/sidebar.jsx`; `lib/roles.js`. Navigation and role destinations. |
| S03 | `app/modules/sign-up-page/`, `sign-in-page/`, `verify-otp-page/`, `forgot-password-page/`, `reset-password-page/`, `change-password-page/`, `accept-terms-page/`; corresponding `app/api/auth/` handlers; `lib/email-otp-policy.js`. Account flows. |
| S04 | `app/modules/profile-page/ProfilePage.jsx` and `DataRightsDialog.jsx`; `app/api/profile/`; `app/api/data-requests/`. Profile and patient requests. |
| S05 | `docs/records.md`; `app/modules/my-records-page/`, `records-page/`; `components/commons/OtpStepUpModal.jsx`, `UnlockRecordsModal.jsx`; `app/api/records/`, `app/api/patient/records/`; `lib/records-access.js`, `recordCrypto.js`, `clientKeys.js`. Record access, editing, and sharing. |
| S06 | `docs/appointments.md`; `app/modules/schedules-page/`, `schedule-page/`, `appointments-page/`; `app/api/schedules/`, `app/api/appointments/`; `lib/appointments.js`, `appointment-conflicts.js`. Patient/staff booking and dentist schedule. |
| S07 | `app/modules/patients-page/`; `app/api/patients/route.js` and `[id]/route.js`. Registration details and enrollment deletion. |
| S08 | `docs/billing.md`; `app/modules/billing-page/`, `my-billing-page/`; `app/api/billing/`, `app/api/patient/billing/`, `app/api/webhooks/paymongo/`; `lib/billing.js`, `paymongo.js`. Bills, checkout, receipts, and payment outcomes. |
| S09 | `app/modules/notifications/`; `app/modules/settings-page/ClinicNotificationSettings.jsx`; `app/api/cron/reminders/route.js`; `vercel.json`. Notification controls and scheduled reminders. |
| S10 | `app/modules/profile-page/DataRightsDialog.jsx`; `app/modules/data-requests-page/`; `app/modules/record-transfers-page/`; `app/api/data-requests/`, `app/api/record-transfers/`, `app/api/patient/clinics/`; `lib/records-access.js`. Requests, approval, transfer execution, and clinic context. |
| S11 | `app/modules/rbac-page/`, `services-page/`, `settings-page/`, `reports-page/`, `audit-log-page/`; related `app/api/users/`, `services/`, `clinics/`, `reports/`, `audit-log/`; `components/commons/StepUpModal.jsx`. Clinic administration. |
| S12 | `docs/security.md`; `lib/email-otp-policy.js`, `login-attempts.js`, `session-state.js`, `roles.js`; authentication/profile handlers and record-access helpers. Security behavior and recovery limits. |
| S13 | `docs/super-admin.md`; `app/modules/super-page/`; `app/(main)/super/`; `app/api/super/`; `lib/restore.js`. Clinic decisions, policy oversight, backup, and restore. |
| S14 | `app/modules/ai-chat/`; AI controls in booking and appointment details; `lib/ai-prompt.js`, `ai-tools.js`; `app/modules/sign-up-page/TermsDialog.jsx`. AI scope and documented limitations. |
| S15 | `README.md`; configuration reference in `CLAUDE.md`; `package.json`; `vercel.json`; `prisma/schema.prisma`; guarded bootstrap documentation in `docs/security.md` and `docs/super-admin.md`. Developer setup and maintenance. |

### 15.2 Meaningful source conflicts and limitations

- **Booking labels and stages:** Older appointment documentation says six steps and “Book Appointment.” The current patient interface uses **Book**, three stages, and **Request booking**. This manual follows the interface.
- **Patient cancellation and rebooking:** Older appointment documentation restricts cancellation to Pending. The current UI and handler accept Pending and Confirmed. **Call to rebook** displays contact information; it does not edit the booking.
- **Rescheduling is not an atomic move:** The form creates a new Confirmed appointment before marking the original Rescheduled. Its request uses the primary service rather than clearly preserving all multi-service selections. The UI offers Reschedule for some Pending entries, but the status handler does not permit Pending → Rescheduled. The manual limits the procedure to Confirmed bookings and directs staff to check for partial success. Multi-service and payment handling need confirmation before use in those cases.
- **Data-request entry point:** The feature tracker mentions a patient sidebar Data Requests entry. The current sidebar instead exposes the patient form through **My Profile → Data Rights**. Current code also supports controlled record transfers and multiple clinic enrollments, which older summaries omit.
- **Record authorization:** Older records documentation describes only confirmed/completed treating relationships. Current helpers also allow active receiving-dentist care assignments. Neither path grants clinical-note access merely because someone is an administrator.
- **Encryption and deletion claims:** The schema PDF broadly describes all sensitive fields as encrypted and data as never permanently deleted. Current security code/documentation distinguishes encrypted notes from attachments and other data, and implements retention purges. The broader historical claims are not repeated as guarantees.
- **Attachment retention:** The Data Retention interface says stored attachments are not automatically removed. Current security documentation and purge implementation describe storage removal before record-reference deletion, with failure retry behavior. The manual follows the implementation and flags the stale text.
- **Password expiry and session lifetime:** Older feature descriptions limit expiry to administrators and describe a fixed 90-day policy. The current form selects roles and 30–365 days. Older 30-minute/three-day session wording conflicts with current server idle checks and an eight-hour absolute cap. The manual does not promise those older durations.
- **User list inconsistency:** The Users server-rendered first page queries all clinic users, while the normal administrator list API excludes patients. Patient rows may appear initially and disappear after reload/filtering. Use Patients for patient administration; arbitrary patient/admin role conversion is not supported.
- **Billing controls and refunds:** Older documentation calls receipt buttons “Receipt PDF” or “Receipt”; the current UI uses **View Receipt** and **Download**. An API refund status is not evidence of a refund button or provider money return. No verified end-user refund procedure is included.
- **Payment availability and toggles:** Reservation creation checks clinic payment settings. The inspected existing-bill checkout handler does not itself enforce `paymongoEnabled`. Therefore the manual does not promise that switching off online payments disables every possible checkout path. Live methods and configuration need confirmation.
- **Reservation wording:** Older billing text implies a fee locks or confirms the appointment. The booking remains Pending and checkout creation can fail after booking succeeds. Patient confirmation and payment must be checked separately.
- **Reminder timing:** Settings refer to hours-before intervals, but deployment configuration runs the job daily and current code uses broad matching windows. Exact 24-hour or 2-hour delivery is not promised.
- **Super portal navigation and recovery:** Older documentation describes Clinics/Applications tabs and some older feature/defense material describes restore as authorization for Neon recovery. The current portal uses sidebar destinations, and **Run Restore** imports a matching JSON file into the application database. It is distinct from provider recovery.
- **OTP exception:** The README records a temporary OTP bypass deadline. The date has passed at preparation time; this is not a permanent login or record-access policy.

### 15.3 Open questions — Needs confirmation

1. **Hosted release and access URL:** Confirm which commit is deployed and the production website address before distributing the manual to patients.
2. **Browser/device/accessibility support:** Test the actual supported browser versions, desktop/tablet/phone layouts, assistive technology, printing, and receipt preview/download.
3. **Live workflow validation:** Perform role-specific acceptance testing with controlled accounts. Email verification, OTP, password reset, booking, encrypted records, payments, exports, and restore were reviewed in code but not exercised against a live service for this manual.
4. **Screenshots:** Capture the labeled placeholder screens from the verified release using fictional data. No application screenshot was fabricated or supplied with this manual.
5. **Clinic contacts and support:** Confirm clinic-specific contact details, who monitors platform support, and expected response times. No invented phone number or recovery contact is provided.
6. **Payment operations:** Confirm enabled payment methods, provider mode, payment-toggle behavior, deposits on reschedule, multi-service totals on replacement bookings, refund handling, and charge reconciliation.
7. **Reschedule defects:** Resolve or explicitly constrain Pending reschedules, partial failure, and multi-service preservation before treating those paths as confirmed workflows.
8. **Data-rights fulfillment:** Establish the actual access-copy, correction, deletion, response-time, retention, and appeal processes. Saving a request status alone does not fulfill a request.
9. **Clinic onboarding:** Confirm approval-to-first-administrator setup and the supported procedure for a pre-existing patient to join an additional clinic outside the implemented transfer/enrollment flow.
10. **Clinical recovery:** Validate key-sharing recovery, transfer execution with attachments, complete backup coverage, and separate database/storage disaster recovery. In-app backup excludes clinical notes and cannot be represented as a full recovery solution.
11. **Policy/UI conflicts:** Resolve the stale retention note, Users first-render mismatch, password-policy descriptions, and AI guidance that uses older booking labels.
12. **Self-service password navigation:** Forced password change and the `/change-password` page exist, but a normal sidebar/profile change-password link was not found. The manual does not invent one.
13. **Patient attachment access:** The patient record viewer inspected here displays notes but does not expose an attachment-download control. Do not infer that patient attachment downloads are available from the record API alone.
14. **Omitted unsupported workflows:** No native-app installation, patient direct date editing, general manual reminder sender, user-facing refund action, arbitrary role conversion, consolidated platform revenue report, or clinical-note recovery by an administrator is presented.

### 15.4 Manual maintenance

The PDF was exported from this Markdown through `md2html --github` and local headless Chrome, with print styling, internal contents links, and numbered page footers. No application server or patient account was used for the export.

Update the source Markdown first. Recheck exact interface labels, roles, and server outcomes at the new application commit, update the cover and this evidence index, then regenerate the PDF from the same Markdown. Replace placeholders only with verified, privacy-safe screenshots. Keep untested claims in Open questions until evidence resolves them.

