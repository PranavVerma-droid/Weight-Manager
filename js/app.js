// API configuration
const API_BASE = '/api';
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// Initialize charts 
let weightChart;
let nutritionChart;
let workoutChart;

// DOM elements
const weightForm = document.getElementById('weight-form');
const dataTableBody = document.getElementById('data-table-body');
const userInfoElement = document.getElementById('user-info');
const logoutBtn = document.getElementById('logout-btn');
const exportDataBtn = document.getElementById('export-data-btn');
const importDataBtn = document.getElementById('import-data-btn');
const importFileInput = document.getElementById('import-file-input');
const importWorkoutBtn = document.getElementById('import-workout-btn');
const workoutFileInput = document.getElementById('workout-file-input');
const workoutTableBody = document.getElementById('workout-table-body');
const deleteSelectedWorkoutsBtn = document.getElementById('delete-selected-workouts');
const selectAllWorkoutsCheckbox = document.getElementById('select-all-workouts');
const settingsBtn = document.getElementById('settings-btn');
const changePasswordForm = document.getElementById('change-password-form');
const changeEmailForm = document.getElementById('change-email-form');
const settingsUserEmail = document.getElementById('settings-user-email');

// API helper function
async function apiCall(endpoint, options = {}) {
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        ...options
    };

    const response = await fetch(API_BASE + endpoint, config);
    
    if (!response.ok) {
        if (response.status === 401) {
            // Token expired, redirect to login
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
            return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is authenticated
    if (!authToken || !currentUser) {
        // Redirect to login page if not authenticated
        window.location.href = 'login.html';
        return;
    }
    
    // Display user info
    if (userInfoElement) {
        userInfoElement.textContent = currentUser.email;
    }
    
    // Set user email in settings modal
    if (settingsUserEmail) {
        settingsUserEmail.textContent = currentUser.email;
    }
    
    // Set default date to current date (no time)
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    document.getElementById('logDate').value = dateString;
    
    await loadData();
    await loadWorkoutData();
});

// Logout handler
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });
}

// Export data handler
if (exportDataBtn) {
    exportDataBtn.addEventListener('click', async () => {
        try {
            const data = await apiCall('/export');
            
            if (!data.weight_logs.length && !data.workouts.length) {
                alert('No data to export');
                return;
            }
            
            // Convert to JSON
            const dataStr = JSON.stringify(data, null, 2);
            
            // Create a download link
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            // Create a date string for the filename
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            
            // Create and click a temporary download link
            const a = document.createElement('a');
            a.href = url;
            a.download = `weight-data-export-${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
            
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Error exporting data: ' + error.message);
        }
    });
}

// Import data handler
if (importDataBtn && importFileInput) {
    importDataBtn.addEventListener('click', () => {
        importFileInput.click();
    });
    
    importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.json')) {
            alert('Please select a JSON file');
            return;
        }
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // Handle both old format (array) and new format (object with weight_logs and workouts)
            let weightLogs = [];
            let workouts = [];
            
            if (Array.isArray(data)) {
                // Old format - assume it's weight logs
                weightLogs = data.map(item => ({
                    log_date: item.logDate || item.log_date,
                    log_weight: item.logWeight || item.log_weight,
                    log_protein: item.logProtein || item.log_protein || 0,
                    log_calories: item.logCalories || item.log_calories || 0,
                    log_carbs: item.logCarbs || item.log_carbs || 0,
                    log_fat: item.logFat || item.log_fat || 0,
                    log_misc_info: item.logMiscInfo || item.log_misc_info || ""
                }));
            } else if (data.weight_logs || data.workouts) {
                // New format
                weightLogs = data.weight_logs || [];
                workouts = data.workouts || [];
            } else {
                alert('Invalid file format');
                return;
            }
            
            if (weightLogs.length === 0 && workouts.length === 0) {
                alert('No data found in the file');
                return;
            }
            
            // Confirm import
            const totalRecords = weightLogs.length + workouts.length;
            const confirmed = confirm(`Are you sure you want to import ${totalRecords} records? (${weightLogs.length} weight logs, ${workouts.length} workouts)`);
            if (!confirmed) return;
            
            // Import data
            const result = await apiCall('/import', {
                method: 'POST',
                body: JSON.stringify({
                    weight_logs: weightLogs,
                    workouts: workouts
                })
            });
            
            // Show results
            let message = `Import completed!\n`;
            message += `Weight logs - Imported: ${result.imported.weight_logs}, Updated: ${result.skipped.weight_logs}\n`;
            message += `Workouts - Imported: ${result.imported.workouts}, Skipped: ${result.skipped.workouts}`;
            alert(message);
            
            // Reload data
            await loadData();
            await loadWorkoutData();
            
            // Clear the file input
            importFileInput.value = '';
            
        } catch (error) {
            console.error('Error importing data:', error);
            alert('Error importing data: ' + error.message);
            importFileInput.value = '';
        }
    });
}

// Form submission handler
weightForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const formData = {
            log_date: document.getElementById('logDate').value,
            log_weight: document.getElementById('logWeight').value ? parseFloat(document.getElementById('logWeight').value) : null,
            log_protein: parseFloat(document.getElementById('logProtein').value) || 0,
            log_calories: parseFloat(document.getElementById('logCalories').value) || 0,
            log_carbs: parseFloat(document.getElementById('logCarbs').value) || 0,
            log_fat: parseFloat(document.getElementById('logFat').value) || 0,
            log_misc_info: document.getElementById('logMiscInfo').value || ""
        };

        await apiCall('/weight', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        // Reset form
        weightForm.reset();
        
        // Set default date to current date again
        const now = new Date();
        const dateString = now.toISOString().split('T')[0];
        document.getElementById('logDate').value = dateString;
        
        // Reload data
        await loadData();
        
        alert('Entry saved successfully!');
    } catch (error) {
        console.error('Error saving data:', error);
        alert('Error saving data: ' + error.message);
    }
});

// Load data from API
async function loadData() {
    try {
        const records = await apiCall('/weight');
        displayTableData(records);
        renderWeightChart(records);
        renderNutritionChart(records);
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading data: ' + error.message);
    }
}

// Display data in table
function displayTableData(items) {
    dataTableBody.innerHTML = '';
    
    items.forEach((item, index) => {
        const row = document.createElement('tr');
        
        // Format date for display
        const date = new Date(item.log_date);
        const formattedDate = date.toLocaleDateString();
        
        // Create a unique ID for the collapse element
        const collapseId = `note-collapse-${index}`;
        
        // Check if there are notes to show the collapse button
        const hasNotes = item.log_misc_info && item.log_misc_info.trim() !== '';
        const notesButton = hasNotes ? 
            `<button class="btn btn-sm btn-outline-primary" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                Show Notes
            </button>` : 
            '<span class="text-muted">No notes</span>';
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${item.log_weight || '-'}</td>
            <td>${item.log_protein}</td>
            <td>${item.log_calories}</td>
            <td>${item.log_carbs}</td>
            <td>${item.log_fat}</td>
            <td>
                ${notesButton}
                <div class="collapse mt-2" id="${collapseId}">
                    <div class="card card-body">
                        ${item.log_misc_info || ''}
                    </div>
                </div>
            </td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editEntry('${item.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteEntry('${item.id}')">Delete</button>
            </td>
        `;
        
        dataTableBody.appendChild(row);
    });
}

// Edit an entry
async function editEntry(id) {
    try {
        // Fetch the record to edit
        const records = await apiCall('/weight');
        const record = records.find(r => r.id == id);
        
        if (!record) {
            alert('Record not found');
            return;
        }
        
        // Populate the form fields with the record data
        document.getElementById('editId').value = record.id;
        
        // Format date for input (YYYY-MM-DD)
        const date = new Date(record.log_date);
        document.getElementById('editDate').value = date.toISOString().split('T')[0];
        
        document.getElementById('editWeight').value = record.log_weight;
        document.getElementById('editProtein').value = record.log_protein;
        document.getElementById('editCalories').value = record.log_calories;
        document.getElementById('editCarbs').value = record.log_carbs;
        document.getElementById('editFat').value = record.log_fat;
        document.getElementById('editMiscInfo').value = record.log_misc_info;
        
        // Show the modal
        const editModal = new bootstrap.Modal(document.getElementById('editModal'));
        editModal.show();
    } catch (error) {
        console.error('Error fetching entry:', error);
        alert('Error fetching entry: ' + error.message);
    }
}

// Save edited entry
document.getElementById('saveEditBtn').addEventListener('click', async () => {
    try {
        const id = document.getElementById('editId').value;
        
        const formData = {
            log_date: document.getElementById('editDate').value,
            log_weight: document.getElementById('editWeight').value ? parseFloat(document.getElementById('editWeight').value) : null,
            log_protein: parseFloat(document.getElementById('editProtein').value) || 0,
            log_calories: parseFloat(document.getElementById('editCalories').value) || 0,
            log_carbs: parseFloat(document.getElementById('editCarbs').value) || 0,
            log_fat: parseFloat(document.getElementById('editFat').value) || 0,
            log_misc_info: document.getElementById('editMiscInfo').value || ""
        };
        
        await apiCall(`/weight/${id}`, {
            method: 'PUT',
            body: JSON.stringify(formData)
        });
        
        // Hide the modal
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
        editModal.hide();
        
        // Reload data
        await loadData();
        
        alert('Entry updated successfully!');
    } catch (error) {
        console.error('Error updating entry:', error);
        alert('Error updating entry: ' + error.message);
    }
});

// Delete an entry
async function deleteEntry(id) {
    if (confirm('Are you sure you want to delete this entry?')) {
        try {
            await apiCall(`/weight/${id}`, {
                method: 'DELETE'
            });
            await loadData();
            alert('Entry deleted successfully!');
        } catch (error) {
            console.error('Error deleting entry:', error);
            alert('Error deleting entry: ' + error.message);
        }
    }
}

// Render weight chart
function renderWeightChart(items) {
    const ctx = document.getElementById('weightChart').getContext('2d');
    
    // Filter items that have weight data
    const weightItems = items.filter(item => item.log_weight && item.log_weight > 0);
    
    if (weightItems.length === 0) {
        // Destroy existing chart if it exists
        if (weightChart) {
            weightChart.destroy();
        }
        
        // Show message when no weight data
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        ctx.fillText('No weight data to display', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    // Format data for chart
    const dates = weightItems.map(item => {
        const date = new Date(item.log_date);
        return date.toLocaleDateString();
    });
    
    const weights = weightItems.map(item => item.log_weight);
    
    // Calculate trend line (simple linear regression)
    let trendLine = [];
    if (weights.length >= 2) {
        const n = weights.length;
        const sumX = weights.reduce((sum, _, i) => sum + i, 0);
        const sumY = weights.reduce((sum, weight) => sum + weight, 0);
        const sumXY = weights.reduce((sum, weight, i) => sum + (i * weight), 0);
        const sumXX = weights.reduce((sum, _, i) => sum + (i * i), 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        trendLine = weights.map((_, i) => slope * i + intercept);
    }
    
    // Destroy existing chart if it exists
    if (weightChart) {
        weightChart.destroy();
    }
    
    // Create datasets
    const datasets = [{
        label: 'Weight (kg)',
        data: weights,
        backgroundColor: 'rgba(54, 162, 235, 0.3)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        pointRadius: 4,
        pointHoverRadius: 6,
        showLine: false // Don't connect the dots
    }];
    
    // Add trend line if we have enough data
    if (trendLine.length >= 2) {
        datasets.push({
            label: 'Trend',
            data: trendLine,
            backgroundColor: 'rgba(255, 99, 132, 0)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            borderDash: [5, 5]
        });
    }
    
    // Create new chart
    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false
                }
            },
            elements: {
                line: {
                    tension: 0
                }
            }
        }
    });
}

// Render nutrition chart
function renderNutritionChart(items) {
    const ctx = document.getElementById('nutritionChart').getContext('2d');
    
    // Format data for chart - get last 7 entries
    const recentItems = items.slice(-7);
    
    const dates = recentItems.map(item => {
        const date = new Date(item.log_date);
        return date.toLocaleDateString();
    });
    
    const proteins = recentItems.map(item => item.log_protein);
    const calories = recentItems.map(item => item.log_calories / 100); // Scale down calories to fit with other metrics
    const carbs = recentItems.map(item => item.log_carbs);
    const fats = recentItems.map(item => item.log_fat);
    
    // Destroy existing chart if it exists
    if (nutritionChart) {
        nutritionChart.destroy();
    }
    
    // Create new chart
    nutritionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Protein (g)',
                    data: proteins,
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Carbs (g)',
                    data: carbs,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Fat (g)',
                    data: fats,
                    backgroundColor: 'rgba(255, 206, 86, 0.5)',
                    borderColor: 'rgba(255, 206, 86, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Calories (x100)',
                    data: calories,
                    backgroundColor: 'rgba(153, 102, 255, 0.5)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1,
                    type: 'line',
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Workout import handler
if (importWorkoutBtn && workoutFileInput) {
    importWorkoutBtn.addEventListener('click', () => {
        workoutFileInput.click();
    });
    
    workoutFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.csv')) {
            alert('Please select a CSV file');
            return;
        }
        
        try {
            const text = await file.text();
            await processHevyCSV(text);
            workoutFileInput.value = '';
        } catch (error) {
            console.error('Error importing workout data:', error);
            alert('Error importing workout data: ' + error.message);
            workoutFileInput.value = '';
        }
    });
}

// Multi-select workout functionality
if (selectAllWorkoutsCheckbox) {
    selectAllWorkoutsCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.workout-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
        });
        updateDeleteButtonState();
    });
}

if (deleteSelectedWorkoutsBtn) {
    deleteSelectedWorkoutsBtn.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('.workout-checkbox:checked');
        const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
        
        if (selectedIds.length === 0) {
            alert('Please select workouts to delete');
            return;
        }
        
        if (confirm(`Are you sure you want to delete ${selectedIds.length} selected workout(s)?`)) {
            try {
                await apiCall('/workouts/delete-multiple', {
                    method: 'POST',
                    body: JSON.stringify({ ids: selectedIds })
                });
                
                await loadWorkoutData();
                alert(`Successfully deleted ${selectedIds.length} workout(s)`);
            } catch (error) {
                console.error('Error deleting workouts:', error);
                alert('Error deleting workouts: ' + error.message);
            }
        }
    });
}

function updateDeleteButtonState() {
    const selectedCheckboxes = document.querySelectorAll('.workout-checkbox:checked');
    if (deleteSelectedWorkoutsBtn) {
        deleteSelectedWorkoutsBtn.disabled = selectedCheckboxes.length === 0;
    }
}

// Settings functionality
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
        settingsModal.show();
    });
}

// Change password form
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            alert('New passwords do not match');
            return;
        }
        
        if (newPassword.length < 6) {
            alert('New password must be at least 6 characters long');
            return;
        }
        
        try {
            await apiCall('/settings/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });
            
            alert('Password changed successfully!');
            changePasswordForm.reset();
            
            // Hide the modal
            const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
            settingsModal.hide();
            
        } catch (error) {
            console.error('Error changing password:', error);
            alert('Error changing password: ' + error.message);
        }
    });
}

// Change email form
if (changeEmailForm) {
    changeEmailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newEmail = document.getElementById('newEmail').value;
        const currentPassword = document.getElementById('emailCurrentPassword').value;
        
        if (!newEmail || !currentPassword) {
            alert('Please fill in all fields');
            return;
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            alert('Please enter a valid email address');
            return;
        }
        
        try {
            const response = await apiCall('/settings/change-email', {
                method: 'POST',
                body: JSON.stringify({
                    newEmail,
                    currentPassword
                })
            });
            
            // Update stored user data
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
            
            // Update global variables
            authToken = response.token;
            currentUser = response.user;
            
            // Update UI
            if (userInfoElement) {
                userInfoElement.textContent = response.user.email;
            }
            if (settingsUserEmail) {
                settingsUserEmail.textContent = response.user.email;
            }
            
            alert('Email changed successfully!');
            changeEmailForm.reset();
            
            // Hide the modal
            const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
            settingsModal.hide();
            
        } catch (error) {
            console.error('Error changing email:', error);
            alert('Error changing email: ' + error.message);
        }
    });
}

// Process Hevy CSV data
async function processHevyCSV(csvText) {
    try {
        const lines = csvText.split('\n');
        if (lines.length < 2) {
            alert('Invalid CSV file');
            return;
        }
        
        // Parse header to find column indices
        const header = lines[0].split(',').map(col => col.replace(/"/g, '').trim());
        const columnIndices = {
            title: header.indexOf('title'),
            start_time: header.indexOf('start_time'),
            end_time: header.indexOf('end_time'),
            exercise_title: header.indexOf('exercise_title'),
            set_index: header.indexOf('set_index'),
            weight_kg: header.indexOf('weight_kg'),
            reps: header.indexOf('reps'),
            duration_seconds: header.indexOf('duration_seconds')
        };
        
        // Group data by workout (title + start_time combination)
        const workoutGroups = new Map();
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const columns = parseCSVLine(line);
            if (columns.length < header.length) continue;
            
            const workoutKey = `${columns[columnIndices.title]}_${columns[columnIndices.start_time]}`;
            
            if (!workoutGroups.has(workoutKey)) {
                workoutGroups.set(workoutKey, {
                    title: columns[columnIndices.title]?.replace(/"/g, ''),
                    start_time: columns[columnIndices.start_time]?.replace(/"/g, ''),
                    end_time: columns[columnIndices.end_time]?.replace(/"/g, ''),
                    exercises: new Map()
                });
            }
            
            const workout = workoutGroups.get(workoutKey);
            const exerciseTitle = columns[columnIndices.exercise_title]?.replace(/"/g, '');
            
            if (!workout.exercises.has(exerciseTitle)) {
                workout.exercises.set(exerciseTitle, []);
            }
            
            const setData = {
                set_index: parseInt(columns[columnIndices.set_index]) || 0,
                weight_kg: parseFloat(columns[columnIndices.weight_kg]) || null,
                reps: parseInt(columns[columnIndices.reps]) || null,
                duration_seconds: parseInt(columns[columnIndices.duration_seconds]) || null
            };
            
            workout.exercises.get(exerciseTitle).push(setData);
        }
        
        // Convert to our database format and import
        let newWorkouts = 0;
        let skippedWorkouts = 0;
        
        for (const [key, workout] of workoutGroups) {
            try {
                // Calculate duration
                const startTime = new Date(workout.start_time);
                const endTime = new Date(workout.end_time);
                const durationMinutes = Math.round((endTime - startTime) / 60000);
                
                // Prepare exercises data
                const exercisesData = [];
                for (const [exerciseTitle, sets] of workout.exercises) {
                    exercisesData.push({
                        title: exerciseTitle,
                        sets: sets
                    });
                }
                
                // Create workout record
                const workoutData = {
                    title: workout.title,
                    workout_date: startTime.toISOString().split('T')[0],
                    start_time: startTime.toTimeString().split(' ')[0],
                    duration_minutes: durationMinutes,
                    exercises: JSON.stringify(exercisesData),
                    total_exercises: exercisesData.length,
                    total_sets: exercisesData.reduce((total, exercise) => total + exercise.sets.length, 0)
                };
                
                await apiCall('/workouts', {
                    method: 'POST',
                    body: JSON.stringify(workoutData)
                });
                newWorkouts++;
                
            } catch (error) {
                if (error.message.includes('400') || error.message.includes('Workout already exists')) {
                    skippedWorkouts++;
                } else {
                    console.error('Error importing workout:', error);
                }
            }
        }
        
        // Show results
        let message = `Import completed!\nNew workouts imported: ${newWorkouts}`;
        if (skippedWorkouts > 0) {
            message += `\nSkipped (already exists): ${skippedWorkouts}`;
        }
        alert(message);
        
        // Reload workout data
        await loadWorkoutData();
        
    } catch (error) {
        console.error('Error processing CSV:', error);
        alert('Error processing CSV: ' + error.message);
    }
}

// Parse CSV line handling quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

// Load workout data from API
async function loadWorkoutData() {
    try {
        const records = await apiCall('/workouts');
        displayWorkoutTable(records);
        renderWorkoutChart(records);
    } catch (error) {
        console.error('Error loading workout data:', error);
    }
}

// Display workout data in table
function displayWorkoutTable(items) {
    if (!workoutTableBody) return;
    
    workoutTableBody.innerHTML = '';
    
    items.forEach(item => {
        const row = document.createElement('tr');
        
        // Format date and time
        const date = new Date(item.workout_date);
        const formattedDate = date.toLocaleDateString();
        const duration = `${item.duration_minutes} min`;
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="workout-checkbox" value="${item.id}" onchange="updateDeleteButtonState()">
            </td>
            <td>${formattedDate}</td>
            <td>${item.title}</td>
            <td>${duration}</td>
            <td>${item.total_exercises}</td>
            <td>${item.total_sets}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewWorkoutDetails('${item.id}')">View Details</button>
                <button class="btn btn-sm btn-danger" onclick="deleteWorkout('${item.id}')">Delete</button>
            </td>
        `;
        
        workoutTableBody.appendChild(row);
    });
    
    // Reset select all checkbox
    if (selectAllWorkoutsCheckbox) {
        selectAllWorkoutsCheckbox.checked = false;
    }
    
    // Update delete button state
    updateDeleteButtonState();
}

// View workout details
async function viewWorkoutDetails(id) {
    try {
        const workout = await apiCall(`/workouts/${id}`);
        const exercises = JSON.parse(workout.exercises);
        
        let detailsHTML = `<h4>${workout.title}</h4>`;
        detailsHTML += `<p><strong>Date:</strong> ${new Date(workout.workout_date).toLocaleDateString()}</p>`;
        detailsHTML += `<p><strong>Duration:</strong> ${workout.duration_minutes} minutes</p>`;
        detailsHTML += `<h5>Exercises:</h5>`;
        
        exercises.forEach(exercise => {
            detailsHTML += `<h6>${exercise.title}</h6>`;
            detailsHTML += `<ul>`;
            exercise.sets.forEach((set, index) => {
                let setInfo = `Set ${set.set_index + 1}: `;
                if (set.weight_kg) setInfo += `${set.weight_kg}kg `;
                if (set.reps) setInfo += `${set.reps} reps `;
                if (set.duration_seconds) setInfo += `${set.duration_seconds}s `;
                detailsHTML += `<li>${setInfo}</li>`;
            });
            detailsHTML += `</ul>`;
        });
        
        // Create a modal or alert to show details
        const detailsWindow = window.open('', '_blank', 'width=600,height=800,scrollbars=yes');
        detailsWindow.document.write(`
            <html>
                <head>
                    <title>Workout Details</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                </head>
                <body class="p-4">
                    ${detailsHTML}
                    <button onclick="window.close()" class="btn btn-secondary mt-3">Close</button>
                </body>
            </html>
        `);
        
    } catch (error) {
        console.error('Error fetching workout details:', error);
        alert('Error fetching workout details: ' + error.message);
    }
}

// Delete workout
async function deleteWorkout(id) {
    if (confirm('Are you sure you want to delete this workout?')) {
        try {
            await apiCall(`/workouts/${id}`, {
                method: 'DELETE'
            });
            await loadWorkoutData();
            alert('Workout deleted successfully!');
        } catch (error) {
            console.error('Error deleting workout:', error);
            alert('Error deleting workout: ' + error.message);
        }
    }
}

// Render workout chart
function renderWorkoutChart(items) {
    const ctx = document.getElementById('workoutChart').getContext('2d');
    
    if (items.length === 0) {
        // Destroy existing chart if it exists
        if (workoutChart) {
            workoutChart.destroy();
        }
        
        // Show message when no workout data
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        ctx.fillText('No workout data to display', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    // Get last 30 days of workouts
    const recentItems = items.slice(0, 30);
    
    // Group workouts by date and count
    const workoutsByDate = new Map();
    const durationByDate = new Map();
    
    recentItems.forEach(item => {
        const date = new Date(item.workout_date).toLocaleDateString();
        workoutsByDate.set(date, (workoutsByDate.get(date) || 0) + 1);
        durationByDate.set(date, (durationByDate.get(date) || 0) + item.duration_minutes);
    });
    
    const dates = Array.from(workoutsByDate.keys()).slice(-14); // Last 14 days
    const workoutCounts = dates.map(date => workoutsByDate.get(date) || 0);
    const durations = dates.map(date => durationByDate.get(date) || 0);
    
    // Destroy existing chart if it exists
    if (workoutChart) {
        workoutChart.destroy();
    }
    
    // Create new chart
    workoutChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Workouts',
                    data: workoutCounts,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Duration (min)',
                    data: durations,
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    type: 'line',
                    fill: false,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Workouts'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Duration (minutes)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });
}

// Make functions globally available
window.editEntry = editEntry;
window.deleteEntry = deleteEntry;
window.viewWorkoutDetails = viewWorkoutDetails;
window.deleteWorkout = deleteWorkout;