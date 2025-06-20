# **App Name**: VeriFace Transit

## Core Features:

- Selfie Intake: Receive user selfie and trigger face verification process using FastAPI to create an API endpoint that receives selfie images.
- CCTV Image Retrieval: Fetch the latest CCTV snapshot from Firebase Storage.
- Face Verification: Perform face matching between the user selfie and the CCTV image using DeepFace and OpenCV.
- Status Update: If the user is found in the CCTV image, update Firebase with verification status.
- FCM Alert: If verification fails within 5 minutes, send an alert to the conductor app using FCM.
- Alert Logging: Log the alert, selfie image, and timestamp in Firestore.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to inspire trust and reliability.
- Background color: Light grey (#EEEEEE), provides a neutral and clean backdrop for system feedback.
- Accent color: Teal (#009688), provides important highlights.
- Font: 'Inter', a grotesque-style sans-serif with a modern, machined, objective, neutral look.
- Use material design icons for representing verification status and alerts.