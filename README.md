# Weight & Diet Management App

A web application for tracking weight, nutrition, and workout data using SQLite database with AI-powered nutrition analysis.

![Weight Management App](images/dashboard.png)

## Features

- **AI-Powered Auto Tracking**: Describe your meals in natural language and get automatic nutrition analysis
- Track weight over time with graphical visualization
- Log nutrition data (protein, carbs, fat, calories)
- Set and track nutrition and weight goals
- Add notes to each entry
- Edit and delete existing entries
- Import workout data from Hevy app CSV exports
- View workout statistics and exercise details
- JSON import/export for data backup
- User authentication
- Local SQLite database (no external dependencies)
- Responsive design (works on mobile and desktop)

## AI Auto Tracking

This app features **AI-powered nutrition analysis** using Ollama and a custom-trained model. Simply describe what you ate, and the AI will automatically extract nutritional information.

### Example Usage:
- Input: *"2 scrambled eggs with buttered toast and a banana"*
- Output: Automatically calculates protein, calories, carbs, and fat

### Pre-trained Model Available

I've published a pre-trained nutrition analysis model to the Ollama registry:

**🤖 Model: [pranavverma/weight-manager](https://ollama.com/pranavverma/Weight-Manager)**

This model is specifically trained for nutrition analysis and provides accurate macro calculations for common foods and meals.

## Ollama Setup for AI Auto Tracking

### Prerequisites for AI Features

1. **Install Ollama**: Download from [https://ollama.ai](https://ollama.ai)
2. **System Requirements**: 
   - At least 8GB RAM (16GB recommended)
   - Modern CPU with good performance
   - 4-8GB free disk space for the model

### Quick Setup (Recommended)

Use the pre-trained model from Ollama registry:

```bash
# Pull the pre-trained nutrition analysis model
ollama pull pranavverma/weight-manager

# Start Ollama service
ollama serve
```

### Alternative: Build Your Own Model

If you prefer to build the model yourself:

```bash
# 1. Pull the base model
ollama pull llama3.2:3b

# 2. Create the custom nutrition model
ollama create nutrition-analyzer -f modelfiles/Modelfile-Auto

# 3. Start Ollama service
ollama serve
```

### Configuration

1. **Environment Setup**: The app will automatically use the correct model if you have the `.env` file configured:

   ```env
   # For pre-trained model (recommended)
   OLLAMA_MODEL=pranavverma/weight-manager:3b
   
   # OR for custom-built model
   OLLAMA_MODEL=nutrition-analyzer
   ```

2. **Verify Setup**: Start your app and check the Ollama health status at:
   ```
   http://localhost:3000/api/ollama/health
   ```

### Using AI Auto Tracking

1. **Navigate to Log Entry** in the app
2. **Click "Auto Log"** to switch to AI mode
3. **Fill in basic details**:
   - Date
   - Meal type (breakfast, lunch, dinner, etc.)
   - Optional: Your current weight
4. **Describe your food** in detail:
   ```
   Examples:
   - "2 scrambled eggs with 1 slice of buttered whole wheat toast"
   - "Large chicken caesar salad with croutons and parmesan"
   - "Grilled salmon fillet with steamed broccoli and brown rice"
   - "Protein smoothie with banana, peanut butter, and whey protein"
   ```
5. **Click "Analyze with AI"**
6. **Review the results** - the AI will provide:
   - Protein content (grams)
   - Total calories
   - Carbohydrates (grams)
   - Fat content (grams)
   - Descriptive notes
7. **Edit if needed** - you can modify any values before saving
8. **Confirm & Log** to save the entry

### Model Performance

The nutrition analysis model provides:
- **High accuracy** for common foods and standard portions
- **Smart portion estimation** based on meal type and context
- **Cooking method awareness** (grilled vs fried affects calories)
- **Comprehensive ingredient recognition** including sauces and toppings

### Troubleshooting AI Features

#### Model Not Found
```bash
# Check available models
ollama list

# Pull the model if missing
ollama pull pranavverma/weight-manager:3b
```

#### Connection Issues
```bash
# Ensure Ollama is running
ollama serve

# Check if port 11434 is available
netstat -tlnp | grep 11434
```

#### Poor Analysis Results
- Be more specific in your food descriptions
- Include cooking methods and portion sizes
- Mention all ingredients and condiments
- You can always edit the AI results before saving

#### Performance Issues
- First analysis may take 30-60 seconds as the model loads
- Subsequent analyses are much faster (2-5 seconds)
- Consider upgrading to a larger model for better accuracy
- Ensure sufficient RAM (8GB minimum, 16GB recommended)

### Model Details

The `pranavverma/weight-manager` model is based on:
- **Base Model**: Llama 3.2 3B
- **Specialized Training**: Nutrition analysis and macro calculation
- **Output Format**: Structured JSON with nutritional data
- **Accuracy**: Optimized for common foods and standard portions
- **Size**: ~2GB download

### Advanced Configuration

For custom deployments, you can modify:

1. **Model Settings** in `.env`:
   ```env
   OLLAMA_HOST=localhost
   OLLAMA_PORT=11434
   OLLAMA_TIMEOUT=30000
   ENABLE_AUTO_NUTRITION=true
   ```

2. **Custom Modelfile**: Edit `modelfiles/Modelfile-Auto` for specific requirements

3. **API Integration**: The app provides these endpoints:
   - `POST /api/analyze-nutrition` - Analyze food description
   - `GET /api/ollama/health` - Check service status

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

5. **Setup AI Auto Tracking (Optional)**

   To enable AI-powered nutrition analysis:
   
   ```bash
   # Install Ollama first: https://ollama.ai
   
   # Pull the pre-trained model
   ollama pull pranavverma/weight-manager
   
   # Start Ollama service
   ollama serve
   ```
   
   The app will automatically detect and use the AI model when available.

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

### AI-Powered Nutrition Analysis
- `POST /api/analyze-nutrition` - Analyze food description and extract nutrition data
- `GET /api/ollama/health` - Check Ollama service status and available models

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