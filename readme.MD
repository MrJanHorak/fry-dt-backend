# FRY - Detection Tool - backend

This is the backend for a tool to help teachers detect which of the FRY words a student has mastered as they are learning to read.

This backend is using NodeJS, Express and Socket.IO

This is a JavaScript project that uses npm for package management.

## Project Structure

- [`.env`](command:_github.copilot.openRelativePath?%5B%22.env%22%5D ".env"): Environment variables for the project.
- [`bin/www.js`](command:_github.copilot.openRelativePath?%5B%22bin%2Fwww.js%22%5D "bin/www.js"): The entry point of the application. Contains the [`bind`](command:_github.copilot.openSymbolInFile?%5B%22bin%2Fwww.js%22%2C%22bind%22%5D "bin/www.js") and [`server`](command:_github.copilot.openSymbolInFile?%5B%22bin%2Fwww.js%22%2C%22server%22%5D "bin/www.js") symbols.
- [`config/database.js`](command:_github.copilot.openRelativePath?%5B%22config%2Fdatabase.js%22%5D "config/database.js"): Configuration for the database.
- [`controllers/`](command:_github.copilot.openRelativePath?%5B%22controllers%2F%22%5D "controllers/"): Contains the logic for handling requests. Includes [`auth.js`](command:_github.copilot.openRelativePath?%5B%22controllers%2Fauth.js%22%5D "controllers/auth.js") for authentication and [`profiles.js`](command:_github.copilot.openRelativePath?%5B%22controllers%2Fprofiles.js%22%5D "controllers/profiles.js") for profile management.
- [`middleware/auth.js`](command:_github.copilot.openRelativePath?%5B%22middleware%2Fauth.js%22%5D "middleware/auth.js"): Middleware for handling authentication.
- [`models/`](command:_github.copilot.openRelativePath?%5B%22models%2F%22%5D "models/"): Contains the data models for the application. Includes [`profile.js`](command:_github.copilot.openRelativePath?%5B%22models%2Fprofile.js%22%5D "models/profile.js") for profiles and [`user.js`](command:_github.copilot.openSymbolInFile?%5B%22bin%2Fwww.js%22%2C%22user.js%22%5D "bin/www.js") for users.
- [`routes/`](command:_github.copilot.openRelativePath?%5B%22routes%2F%22%5D "routes/"): Contains the routes for the application. Includes [`auth.js`](command:_github.copilot.openRelativePath?%5B%22controllers%2Fauth.js%22%5D "controllers/auth.js") for authentication routes and [`profiles.js`](command:_github.copilot.openRelativePath?%5B%22controllers%2Fprofiles.js%22%5D "controllers/profiles.js") for profile routes.
- [`server.js`](command:_github.copilot.openRelativePath?%5B%22server.js%22%5D "server.js"): Sets up the server for the application.
- [`socket.js`](command:_github.copilot.openRelativePath?%5B%22socket.js%22%5D "socket.js"): Handles socket connections for real-time communication.
- [`utils/leave-room.js`](command:_github.copilot.openRelativePath?%5B%22utils%2Fleave-room.js%22%5D "utils/leave-room.js"): Utility for handling room leaving operations.

## Setup

1. Install dependencies:

```sh
npm install
```

2. Start the server
```sh
npm start
```
