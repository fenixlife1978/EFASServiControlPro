# **App Name**: EduGuard Pro

## Core Features:

- Mass Enrollment: Generate QR codes for mass enrollment of devices using enrollment tokens.
- App Blocking: Agent that blocks unauthorized applications using an overlay when the device is in 'Published' mode.
- Realtime Switch: Binary switch for each device or group to instantly activate or deactivate restrictions, using Firebase Realtime Database for reading.
- Usage Reports: Visualize usage time per application and number of violations with interactive graphs. This is updated from batched data to save on database writes.
- Direct Messaging: System for sending popup messages to student tablets with read confirmation. Consider it as tool because you'll want to use an LLM to confirm language appropriate messages before sending it.
- Admin Authentication: JWT-based authentication for administrators with token validation on each backend request.
- Super Admin Controls: Master switch for the Super Admin to suspend institutions.

## Style Guidelines:

- Primary color: Deep blue (#1A237E), evoking trust, security, and focus.
- Background color: Very light gray-blue (#F0F4FF), creating a clean and unobtrusive backdrop.
- Accent color: Soft teal (#338A8A) provides subtle highlights without distracting.
- Font: 'Inter' sans-serif, for both headlines and body text, lends a modern, neutral, and machined look.
- Simple, geometric icons for easy recognition and navigation.
- Responsive grid-based layout for optimal viewing on all devices, desktop to mobile.
- Subtle transitions and animations for a smooth and intuitive user experience.