const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Ollama Configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_PORT = process.env.OLLAMA_PORT || '11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'nutrition-analyzer';
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT) || 30000;

// Default admin credentials (can be changed via settings)
const DEFAULT_ADMIN = {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'admin123'
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Initialize SQLite database
const dbPath = path.join(dataDir, 'weight_manager.db');
const db = new sqlite3.Database(dbPath);

    // Create tables
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Weight tracking table
        db.run(`CREATE TABLE IF NOT EXISTS weight_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            log_date TEXT NOT NULL,
            log_weight REAL,
            log_protein REAL DEFAULT 0,
            log_calories REAL DEFAULT 0,
            log_carbs REAL DEFAULT 0,
            log_fat REAL DEFAULT 0,
            log_misc_info TEXT,
            meal_type TEXT DEFAULT 'full_day',
            meal_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Workouts table
        db.run(`CREATE TABLE IF NOT EXISTS workouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            workout_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            exercises TEXT NOT NULL,
            total_exercises INTEGER NOT NULL,
            total_sets INTEGER NOT NULL,
            description TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Goals table
        db.run(`CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            goal_type TEXT NOT NULL CHECK(goal_type IN ('weight_loss', 'weight_gain', 'maintenance', 'calorie', 'protein')),
            title TEXT NOT NULL,
            current_value REAL,
            target_value REAL,
            target_date TEXT,
            daily_limit REAL,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused', 'cancelled')),
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Goal progress table
        db.run(`CREATE TABLE IF NOT EXISTS goal_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            goal_id INTEGER,
            recorded_value REAL NOT NULL,
            progress_percentage REAL NOT NULL,
            notes TEXT,
            recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (goal_id) REFERENCES goals (id)
        )`);

        // Create default admin user (password: admin123)
        const defaultPassword = bcrypt.hashSync(DEFAULT_ADMIN.password, 10);
        db.run(`INSERT OR IGNORE INTO users (email, password) VALUES (?, ?)`, 
            [DEFAULT_ADMIN.email, defaultPassword]);
    });// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Auth routes
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
        res.json({ token, user: { id: user.id, email: user.email } });
    });
});

// Weight logs routes
app.get('/api/weight', authenticateToken, (req, res) => {
    db.all('SELECT * FROM weight_logs WHERE user_id = ? ORDER BY log_date ASC', 
        [req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Get daily summary (grouped by date)
app.get('/api/weight/daily-summary', authenticateToken, (req, res) => {
    db.all(`SELECT 
        log_date,
        SUM(log_calories) as total_calories,
        SUM(log_protein) as total_protein,
        SUM(log_carbs) as total_carbs,
        SUM(log_fat) as total_fat,
        AVG(CASE WHEN log_weight IS NOT NULL THEN log_weight END) as avg_weight,
        COUNT(*) as meal_count
        FROM weight_logs 
        WHERE user_id = ? 
        GROUP BY log_date 
        ORDER BY log_date DESC`, 
        [req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Get specific day details
app.get('/api/weight/day/:date', authenticateToken, (req, res) => {
    db.all('SELECT * FROM weight_logs WHERE user_id = ? AND log_date = ? ORDER BY created_at ASC', 
        [req.user.id, req.params.date], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/weight', authenticateToken, (req, res) => {
    const { log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info, meal_type, meal_name } = req.body;
    
    db.run(`INSERT INTO weight_logs 
        (user_id, log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info, meal_type, meal_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info, meal_type || 'full_day', meal_name],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id: this.lastID });
        });
});

app.put('/api/weight/:id', authenticateToken, (req, res) => {
    const { log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info, meal_type, meal_name } = req.body;
    
    db.run(`UPDATE weight_logs 
        SET log_date = ?, log_weight = ?, log_protein = ?, log_calories = ?, 
            log_carbs = ?, log_fat = ?, log_misc_info = ?, meal_type = ?, meal_name = ?
        WHERE id = ? AND user_id = ?`,
        [log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info, meal_type || 'full_day', meal_name, req.params.id, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true });
        });
});

app.delete('/api/weight/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM weight_logs WHERE id = ? AND user_id = ?', 
        [req.params.id, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

// Workout routes
app.get('/api/workouts', authenticateToken, (req, res) => {
    db.all('SELECT * FROM workouts WHERE user_id = ? ORDER BY workout_date DESC, start_time DESC', 
        [req.user.id], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/workouts', authenticateToken, (req, res) => {
    const { title, workout_date, start_time, duration_minutes, exercises, total_exercises, total_sets, description } = req.body;
    
    // Check if workout already exists
    db.get('SELECT id FROM workouts WHERE user_id = ? AND workout_date = ? AND start_time = ? AND title = ?', 
        [req.user.id, workout_date, start_time, title], (err, existing) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing) {
            return res.status(400).json({ error: 'Workout already exists' });
        }
        
        db.run(`INSERT INTO workouts 
            (user_id, title, workout_date, start_time, duration_minutes, exercises, total_exercises, total_sets, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, title, workout_date, start_time, duration_minutes, exercises, total_exercises, total_sets, description || ''],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ id: this.lastID });
            });
    });
});

app.get('/api/workouts/:id', authenticateToken, (req, res) => {
    db.get('SELECT * FROM workouts WHERE id = ? AND user_id = ?', 
        [req.params.id, req.user.id], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Workout not found' });
        }
        res.json(row);
    });
});

app.delete('/api/workouts/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM workouts WHERE id = ? AND user_id = ?', 
        [req.params.id, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

// Delete multiple workouts
app.post('/api/workouts/delete-multiple', authenticateToken, (req, res) => {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid workout IDs' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM workouts WHERE id IN (${placeholders}) AND user_id = ?`;
    const params = [...ids, req.user.id];
    
    db.run(query, params, function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, deletedCount: this.changes });
    });
});

// Goals routes
app.get('/api/goals', authenticateToken, (req, res) => {
    db.all('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC', 
        [req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/goals', authenticateToken, (req, res) => {
    const { goal_type, title, current_value, target_value, target_date, daily_limit, notes } = req.body;
    
    if (!goal_type || !title) {
        return res.status(400).json({ error: 'Goal type and title are required' });
    }
    
    // Check for existing active calorie/protein goals
    if (goal_type === 'calorie' || goal_type === 'protein') {
        db.get('SELECT id FROM goals WHERE user_id = ? AND goal_type = ? AND status = "active"', 
            [req.user.id, goal_type], (err, existing) => {
            if (err) {
                console.error('Database error checking existing goals:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (existing) {
                return res.status(400).json({ error: `You already have an active ${goal_type} goal` });
            }
            
            // Create daily limit goal
            if (!daily_limit) {
                return res.status(400).json({ error: 'Daily limit is required for calorie/protein goals' });
            }
            
            db.run(`INSERT INTO goals 
                (user_id, goal_type, title, daily_limit, notes)
                VALUES (?, ?, ?, ?, ?)`,
                [req.user.id, goal_type, title, daily_limit, notes || ''],
                function(err) {
                    if (err) {
                        console.error('Database error creating daily limit goal:', err);
                        return res.status(500).json({ error: 'Database error: ' + err.message });
                    }
                    res.json({ id: this.lastID, success: true });
                });
        });
    } else {
        // Weight-related goals
        if (current_value == null || target_value == null || !target_date) {
            return res.status(400).json({ error: 'Current value, target value, and target date are required for weight goals' });
        }
        
        db.run(`INSERT INTO goals 
            (user_id, goal_type, title, current_value, target_value, target_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, goal_type, title, current_value, target_value, target_date, notes || ''],
            function(err) {
                if (err) {
                    console.error('Database error creating weight goal:', err);
                    return res.status(500).json({ error: 'Database error: ' + err.message });
                }
                res.json({ id: this.lastID, success: true });
            });
    }
});

app.put('/api/goals/:id', authenticateToken, (req, res) => {
    const { goal_type, title, current_value, target_value, target_date, status, notes } = req.body;
    
    db.run(`UPDATE goals 
        SET goal_type = ?, title = ?, current_value = ?, target_value = ?, 
            target_date = ?, status = ?, notes = ?
        WHERE id = ? AND user_id = ?`,
        [goal_type, title, current_value, target_value, target_date, status || 'active', notes || '', req.params.id, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true });
        });
});

app.delete('/api/goals/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM goals WHERE id = ? AND user_id = ?', 
        [req.params.id, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

// Complete goal
app.post('/api/goals/:id/complete', authenticateToken, (req, res) => {
    const { recorded_value, notes } = req.body;
    
    db.run(`UPDATE goals 
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Add progress entry
        if (recorded_value != null) {
            db.run(`INSERT INTO goal_progress 
                (goal_id, recorded_value, progress_percentage, notes)
                VALUES (?, ?, 100, ?)`,
                [req.params.id, recorded_value, notes || '']);
        }
        
        res.json({ success: true });
    });
});

// Add goal progress entry
app.post('/api/goals/:id/progress', authenticateToken, (req, res) => {
    const { recorded_value, notes } = req.body;
    
    if (recorded_value == null) {
        return res.status(400).json({ error: 'Recorded value is required' });
    }
    
    // Get goal details to calculate progress
    db.get('SELECT * FROM goals WHERE id = ? AND user_id = ?', 
        [req.params.id, req.user.id], (err, goal) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }
        
        // Calculate progress percentage for weight goals
        let progressPercentage = 0;
        if (goal.goal_type === 'weight_loss' || goal.goal_type === 'weight_gain' || goal.goal_type === 'maintenance') {
            const totalChange = goal.target_value - goal.current_value;
            const currentChange = recorded_value - goal.current_value;
            progressPercentage = totalChange === 0 ? 100 : Math.min(100, Math.max(0, (currentChange / totalChange) * 100));
        }
        
        db.run(`INSERT INTO goal_progress 
            (goal_id, recorded_value, progress_percentage, notes)
            VALUES (?, ?, ?, ?)`,
            [req.params.id, recorded_value, progressPercentage, notes || ''], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Update goal current value for weight goals
            if (goal.goal_type === 'weight_loss' || goal.goal_type === 'weight_gain' || goal.goal_type === 'maintenance') {
                db.run('UPDATE goals SET current_value = ? WHERE id = ?', 
                    [recorded_value, req.params.id]);
            }
            
            res.json({ id: this.lastID, success: true, progress_percentage: progressPercentage });
        });
    });
});

// Get goal progress
app.get('/api/goals/:id/progress', authenticateToken, (req, res) => {
    db.all(`SELECT gp.*, g.title, g.goal_type 
        FROM goal_progress gp 
        JOIN goals g ON gp.goal_id = g.id 
        WHERE g.id = ? AND g.user_id = ? 
        ORDER BY gp.recorded_at ASC`, 
        [req.params.id, req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Ollama nutrition analysis route
app.post('/api/analyze-nutrition', authenticateToken, async (req, res) => {
    const { description, mealType } = req.body;
    
    if (!description || !description.trim()) {
        return res.status(400).json({ error: 'Food description is required' });
    }
    
    try {
        const ollamaUrl = `http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/generate`;
        
        // Enhance the prompt with meal type context
        const mealContext = mealType ? `This is a ${mealType.replace('_', ' ')} meal. ` : '';
        const prompt = `${mealContext}${description.trim()}`;
        
        console.log('Sending to Ollama:', { model: OLLAMA_MODEL, prompt });
        
        const ollamaResponse = await axios.post(ollamaUrl, {
            model: OLLAMA_MODEL,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.1,
                top_p: 0.8,
                top_k: 20
            }
        }, {
            timeout: OLLAMA_TIMEOUT,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Ollama raw response:', ollamaResponse.data.response);
        
        // Parse the JSON response from Ollama
        let nutritionData;
        try {
            // Clean the response - remove any markdown formatting or extra text
            let cleanResponse = ollamaResponse.data.response.trim();
            
            // Look for JSON content between curly braces
            const jsonMatch = cleanResponse.match(/\{[^}]*\}/);
            if (jsonMatch) {
                cleanResponse = jsonMatch[0];
            }
            
            // Remove any markdown code block markers
            cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            
            console.log('Cleaned response:', cleanResponse);
            
            nutritionData = JSON.parse(cleanResponse);
            
            // Validate required fields
            const requiredFields = ['log_protein', 'log_calories', 'log_carbs', 'log_fat', 'notes'];
            for (const field of requiredFields) {
                if (nutritionData[field] === undefined || nutritionData[field] === null) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }
            
            // Ensure numeric values are numbers
            nutritionData.log_protein = parseFloat(nutritionData.log_protein) || 0;
            nutritionData.log_calories = parseFloat(nutritionData.log_calories) || 0;
            nutritionData.log_carbs = parseFloat(nutritionData.log_carbs) || 0;
            nutritionData.log_fat = parseFloat(nutritionData.log_fat) || 0;
            
            // Round to 1 decimal place
            nutritionData.log_protein = Math.round(nutritionData.log_protein * 10) / 10;
            nutritionData.log_calories = Math.round(nutritionData.log_calories * 10) / 10;
            nutritionData.log_carbs = Math.round(nutritionData.log_carbs * 10) / 10;
            nutritionData.log_fat = Math.round(nutritionData.log_fat * 10) / 10;
            
        } catch (parseError) {
            console.error('JSON parsing error:', parseError);
            console.error('Raw response that failed to parse:', ollamaResponse.data.response);
            
            // Fallback: try to extract numbers from the response
            const response = ollamaResponse.data.response;
            const proteinMatch = response.match(/protein["\s:]*(\d+\.?\d*)/i);
            const caloriesMatch = response.match(/calories["\s:]*(\d+\.?\d*)/i);
            const carbsMatch = response.match(/carbs["\s:]*(\d+\.?\d*)/i);
            const fatMatch = response.match(/fat["\s:]*(\d+\.?\d*)/i);
            
            if (proteinMatch && caloriesMatch && carbsMatch && fatMatch) {
                nutritionData = {
                    log_protein: parseFloat(proteinMatch[1]) || 0,
                    log_calories: parseFloat(caloriesMatch[1]) || 0,
                    log_carbs: parseFloat(carbsMatch[1]) || 0,
                    log_fat: parseFloat(fatMatch[1]) || 0,
                    notes: `AI analysis of: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`
                };
            } else {
                return res.status(500).json({ 
                    error: 'Failed to parse nutrition data from AI response',
                    details: 'The AI model may need retraining. Please use manual entry.',
                    rawResponse: ollamaResponse.data.response.substring(0, 200)
                });
            }
        }
        
        console.log('Parsed nutrition data:', nutritionData);
        
        res.json({
            success: true,
            nutrition: nutritionData,
            confidence: 0.8, // You could implement actual confidence scoring
            originalDescription: description
        });
        
    } catch (error) {
        console.error('Ollama API error:', error);
        
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ 
                error: 'AI service unavailable',
                details: 'Please ensure Ollama is running and the nutrition-analyzer model is available.'
            });
        }
        
        if (error.response) {
            console.error('Ollama response error:', error.response.data);
            return res.status(500).json({ 
                error: 'AI analysis failed',
                details: error.response.data?.error || 'Unknown error from AI service'
            });
        }
        
        return res.status(500).json({ 
            error: 'Failed to analyze nutrition',
            details: error.message 
        });
    }
});

// Health check for Ollama service
app.get('/api/ollama/health', authenticateToken, async (req, res) => {
    try {
        const ollamaUrl = `http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`;
        const response = await axios.get(ollamaUrl, { timeout: 5000 });
        
        const hasNutritionModel = response.data.models?.some(model => 
            model.name === OLLAMA_MODEL || model.name.includes('nutrition')
        );
        
        res.json({
            status: 'healthy',
            models: response.data.models || [],
            hasNutritionModel,
            recommendedModel: OLLAMA_MODEL
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            suggestion: 'Please ensure Ollama is running and the nutrition-analyzer model is available.'
        });
    }
});

// Change admin password
app.post('/api/settings/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user || !await bcrypt.compare(currentPassword, user.password)) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        
        db.run('UPDATE users SET password = ? WHERE id = ?', 
            [hashedNewPassword, req.user.id], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to update password' });
            }
            res.json({ success: true, message: 'Password updated successfully' });
        });
    });
});

// Change admin email
app.post('/api/settings/change-email', authenticateToken, async (req, res) => {
    const { newEmail, currentPassword } = req.body;
    
    if (!newEmail || !currentPassword) {
        return res.status(400).json({ error: 'New email and current password are required' });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user || !await bcrypt.compare(currentPassword, user.password)) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Check if email already exists (for other users)
        db.get('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail, req.user.id], (err, existingUser) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (existingUser) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            
            db.run('UPDATE users SET email = ? WHERE id = ?', 
                [newEmail, req.user.id], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Failed to update email' });
                }
                
                // Generate new token with updated email
                const newToken = jwt.sign({ id: req.user.id, email: newEmail }, JWT_SECRET);
                res.json({ 
                    success: true, 
                    message: 'Email updated successfully',
                    token: newToken,
                    user: { id: req.user.id, email: newEmail }
                });
            });
        });
    });
});

// Export data
app.get('/api/export', authenticateToken, (req, res) => {
    const weightPromise = new Promise((resolve, reject) => {
        db.all('SELECT * FROM weight_logs WHERE user_id = ? ORDER BY log_date ASC', 
            [req.user.id], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    const workoutsPromise = new Promise((resolve, reject) => {
        db.all('SELECT * FROM workouts WHERE user_id = ? ORDER BY workout_date DESC', 
            [req.user.id], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    Promise.all([weightPromise, workoutsPromise])
        .then(([weightData, workoutData]) => {
            res.json({
                weight_logs: weightData,
                workouts: workoutData,
                exported_at: new Date().toISOString()
            });
        })
        .catch(err => {
            res.status(500).json({ error: 'Export failed' });
        });
});

// Import data
app.post('/api/import', authenticateToken, (req, res) => {
    const { weight_logs, workouts } = req.body;
    let importedWeight = 0;
    let importedWorkouts = 0;
    let skippedWeight = 0;
    let skippedWorkouts = 0;

    const importWeight = () => {
        return new Promise((resolve) => {
            if (!weight_logs || weight_logs.length === 0) {
                return resolve();
            }

            let processed = 0;
            weight_logs.forEach(entry => {
                // Check if entry already exists
                db.get('SELECT id FROM weight_logs WHERE user_id = ? AND log_date = ?', 
                    [req.user.id, entry.log_date], (err, existing) => {
                    if (existing) {
                        // Update existing
                        db.run(`UPDATE weight_logs 
                            SET log_weight = ?, log_protein = ?, log_calories = ?, 
                                log_carbs = ?, log_fat = ?, log_misc_info = ?
                            WHERE user_id = ? AND log_date = ?`,
                            [entry.log_weight, entry.log_protein, entry.log_calories, 
                             entry.log_carbs, entry.log_fat, entry.log_misc_info, 
                             req.user.id, entry.log_date], () => {
                            skippedWeight++;
                            processed++;
                            if (processed === weight_logs.length) resolve();
                        });
                    } else {
                        // Insert new
                        db.run(`INSERT INTO weight_logs 
                            (user_id, log_date, log_weight, log_protein, log_calories, log_carbs, log_fat, log_misc_info)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [req.user.id, entry.log_date, entry.log_weight, entry.log_protein, 
                             entry.log_calories, entry.log_carbs, entry.log_fat, entry.log_misc_info], () => {
                            importedWeight++;
                            processed++;
                            if (processed === weight_logs.length) resolve();
                        });
                    }
                });
            });
        });
    };

    const importWorkouts = () => {
        return new Promise((resolve) => {
            if (!workouts || workouts.length === 0) {
                return resolve();
            }

            let processed = 0;
            workouts.forEach(workout => {
                // Check if workout already exists
                db.get('SELECT id FROM workouts WHERE user_id = ? AND workout_date = ? AND start_time = ? AND title = ?', 
                    [req.user.id, workout.workout_date, workout.start_time, workout.title], (err, existing) => {
                    if (existing) {
                        skippedWorkouts++;
                        processed++;
                        if (processed === workouts.length) resolve();
                    } else {
                        // Insert new
                        db.run(`INSERT INTO workouts 
                            (user_id, title, workout_date, start_time, duration_minutes, exercises, total_exercises, total_sets, description)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [req.user.id, workout.title, workout.workout_date, workout.start_time, 
                             workout.duration_minutes, workout.exercises, workout.total_exercises, workout.total_sets, workout.description || ''], () => {
                            importedWorkouts++;
                            processed++;
                            if (processed === workouts.length) resolve();
                        });
                    }
                });
            });
        });
    };

    importWeight()
        .then(() => importWorkouts())
        .then(() => {
            res.json({
                success: true,
                imported: {
                    weight_logs: importedWeight,
                    workouts: importedWorkouts
                },
                skipped: {
                    weight_logs: skippedWeight,
                    workouts: skippedWorkouts
                }
            });
        })
        .catch(err => {
            res.status(500).json({ error: 'Import failed' });
        });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});