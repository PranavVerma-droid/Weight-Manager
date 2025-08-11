# Weight & Diet Management App

A web application for tracking weight, nutrition, and workout data using SQLite database.

![Weight Management App](images/dashboard.png)

## Features

- Track weight over time with graphical visualization
- Log nutrition data (protein, carbs, fat, calories)
- Add notes to each entry
- Edit and delete existing entries
- Import workout data from Hevy app CSV exports
- View workout statistics and exercise details
- JSON import/export for data backup
- User authentication
- Local SQLite database (no external dependencies)
- Responsive design (works on mobile and desktop)

## Setup Guide

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Quick Start

1. **Clone this repository**

   ```bash
   git clone https://github.com/PranavVerma-droid/Weight.git
   cd Weight
   ```

2. **Run the startup script**

   ```bash
   chmod +x start.sh
   ./start.sh
   ```

   Or manually:

   ```bash
   npm install
   npm start
   ```

3. **Access the application**

   Open `http://localhost:3000` in your browser

4. **Login**

   Default credentials:
   - Email: `admin@example.com`
   - Password: `admin123`

### Manual Setup

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Start the Server**

   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

3. **Database Location**

   The SQLite database will be automatically created at `data/weight_manager.db`

### Database Schema

The application automatically creates the following tables:

#### Users Table
| Field      | Type     | Description |
|------------|----------|-------------|
| id         | INTEGER  | Primary key |
| email      | TEXT     | User email (unique) |
| password   | TEXT     | Hashed password |
| created_at | DATETIME | Account creation date |

#### Weight Logs Table
| Field        | Type     | Description |
|--------------|----------|-------------|
| id           | INTEGER  | Primary key |
| user_id      | INTEGER  | Foreign key to users |
| log_date     | TEXT     | Date of entry |
| log_weight   | REAL     | Weight in kg |
| log_protein  | REAL     | Protein in grams |
| log_calories | REAL     | Calories |
| log_carbs    | REAL     | Carbohydrates in grams |
| log_fat      | REAL     | Fat in grams |
| log_misc_info| TEXT     | Additional notes |
| created_at   | DATETIME | Entry creation date |

#### Workouts Table
| Field            | Type     | Description |
|------------------|----------|-------------|
| id               | INTEGER  | Primary key |
| user_id          | INTEGER  | Foreign key to users |
| title            | TEXT     | Workout name |
| workout_date     | TEXT     | Date of workout |
| start_time       | TEXT     | Start time (HH:MM:SS) |
| duration_minutes | INTEGER  | Duration in minutes |
| exercises        | TEXT     | JSON string of exercise data |
| total_exercises  | INTEGER  | Number of exercises |
| total_sets       | INTEGER  | Total number of sets |
| created_at       | DATETIME | Entry creation date |

## Production Deployment

### Using SystemD Service

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure the service file**

   The repository includes a `weight-manager.service` file. Edit it if needed to update the user and paths:

   ```bash
   # Open the service file to edit
   nano weight-manager.service
   ```
   
   Ensure these values match your system:
   ```
   User=your_username
   WorkingDirectory=/path/to/weight-manager
   ExecStart=/usr/bin/node server.js
   ```

3. **Deploy the service**

   ```bash
   # Create a symlink to the systemd directory
   sudo ln -sf $(pwd)/weight-manager.service /etc/systemd/system/
   
   # Reload systemd to recognize the new service
   sudo systemctl daemon-reload
   
   # Enable and start the service
   sudo systemctl enable weight-manager
   sudo systemctl start weight-manager
   ```

4. **Check the service status**

   ```bash
   sudo systemctl status weight-manager
   ```

The app will now be running on port 3000 and will automatically start on system boot.

### Using Nginx as Reverse Proxy (Recommended)

For production, use Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## API Endpoints

The application provides a REST API:

### Authentication
- `POST /api/auth/login` - Login with email/password

### Weight Logs
- `GET /api/weight` - Get all weight entries
- `POST /api/weight` - Create new weight entry
- `PUT /api/weight/:id` - Update weight entry
- `DELETE /api/weight/:id` - Delete weight entry

### Workouts
- `GET /api/workouts` - Get all workouts
- `POST /api/workouts` - Create new workout
- `GET /api/workouts/:id` - Get specific workout
- `DELETE /api/workouts/:id` - Delete workout

### Data Management
- `GET /api/export` - Export all data as JSON
- `POST /api/import` - Import data from JSON

## File Structure

```
/
├── server.js              # Main server file
├── package.json           # Dependencies
├── start.sh              # Startup script
├── data/                 # SQLite database directory
│   └── weight_manager.db # SQLite database file
├── js/
│   ├── app.js           # Main frontend application
│   └── auth.js          # Authentication handling
├── index.html           # Main application page
├── login.html           # Login page
└── README.md           # This file
```

## Troubleshooting

- **Port already in use**: Change the PORT in server.js or set PORT environment variable
- **Database issues**: Delete `data/weight_manager.db` to reset the database
- **Login issues**: Use the default credentials: admin@example.com / admin123
- **CSV Import errors**: Ensure the CSV file is from Hevy app export
- **Service not starting**: Check if Node.js is installed and dependencies are installed

## Development

To contribute or modify the application:

1. **Start in development mode**
   ```bash
   npm run dev
   ```

2. **Database changes**
   
   Modify the table creation in `server.js` around line 30-60

3. **Frontend changes**
   
   Edit `js/app.js` for functionality or `index.html` for UI

4. **API changes**
   
   Modify routes in `server.js`

## Backup and Migration

### Backup Data
```bash
# Export via API
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/export > backup.json

# Or use the export button in the web interface
```

### Restore Data
```bash
# Import via API
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" \
  -d @backup.json http://localhost:3000/api/import

# Or use the import button in the web interface
```

### Database Migration
Simply copy the `data/weight_manager.db` file to backup or move the database.

## Troubleshooting

- **Authentication Issues**: Make sure your PocketBase URL is correct and your user credentials are valid
- **CORS Errors**: Ensure PocketBase is configured to allow requests from your app's domain
- **Chart Not Displaying**: Check if you have entries in the database
- **Service Not Starting**: Check the service logs with `journalctl -u weight-manager`

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [PocketBase](https://pocketbase.io/) for the backend
- [Bootstrap](https://getbootstrap.com/) for the UI components
- [Chart.js](https://www.chartjs.org/) for data visualization