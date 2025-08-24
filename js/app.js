// API configuration
const API_BASE = '/api';
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

// Initialize charts 
let weightChart;
let nutritionChart;
let workoutChart;
let goalsChart;

// Mobile workout selection
let selectedWorkouts = new Set();

// Goals data
let goalsData = [];

// Navigation state
let currentSection = 'nutrition';
let currentDate = new Date(); // Track current selected date

// DOM elements
const weightForm = document.getElementById('weight-form');
const weightEntryForm = document.getElementById('weight-entry-form');
const dataTableBody = document.getElementById('data-table-body');
const exportDataBtn = document.getElementById('export-data-nav');
const importDataBtn = document.getElementById('import-data-nav');
const importFileInput = document.getElementById('import-file-input');
const importWorkoutBtn = document.getElementById('import-workout-btn');
const workoutFileInput = document.getElementById('workout-file-input');
const workoutTableBody = document.getElementById('workout-table-body');
const deleteSelectedWorkoutsBtn = document.getElementById('delete-selected-workouts');
const selectAllWorkoutsCheckbox = document.getElementById('select-all-workouts');
const settingsBtn = document.getElementById('settings-nav');
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

// Navigation functionality
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const sections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionName = item.dataset.section;
            switchSection(sectionName);
            
            // Update nav active states
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function switchSection(sectionName) {
    const sections = document.querySelectorAll('.content-section');
    
    // Hide all sections
    sections.forEach(section => {
        section.style.display = 'none';
    });
    
    // Show target section
    const targetSection = document.getElementById(`${sectionName}-content`);
    if (targetSection) {
        targetSection.style.display = 'block';
        currentSection = sectionName;
        
        // Update breadcrumb
        updateBreadcrumb(sectionName);
        
        // Load section-specific data
        loadSectionData(sectionName);
    }
}

function updateBreadcrumb(sectionName) {
    const breadcrumb = document.querySelector('.breadcrumb span');
    const sectionTitles = {
        'nutrition': 'Nutrition Analytics',
        'workouts': 'Workout Analytics',
        'goals': 'Goals & Progress',
        'data-entry': 'Daily Log'
    };
    
    if (breadcrumb) {
        breadcrumb.textContent = sectionTitles[sectionName] || 'Dashboard';
    }
}

function loadSectionData(sectionName) {
    switch(sectionName) {
        case 'nutrition':
            loadData();
            updateStats();
            break;
        case 'workouts':
            loadWorkoutData();
            break;
        case 'goals':
            loadGoalsData();
            break;
        case 'data-entry':
            initializeCalendarInterface();
            break;
    }
}

// Global function to show data entry section
window.showDataEntry = function() {
    switchSection('data-entry');
    // Update nav
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelector('.nav-item[data-section="data-entry"]').classList.add('active');
};

// Mobile menu toggle
function initMobileMenu() {
    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('mobile-open');
        });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && 
            sidebar &&
            !sidebar.contains(e.target) && 
            !e.target.closest('#mobile-toggle') &&
            sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
        }
    });
    
    // Close sidebar when clicking on a nav item on mobile
    if (sidebar) {
        sidebar.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 && e.target.closest('.nav-item')) {
                sidebar.classList.remove('mobile-open');
            }
        });
    }
}

// User menu functionality
function initUserMenu() {
    const settingsDropdown = document.getElementById('settings-dropdown');
    const logoutDropdown = document.getElementById('logout-dropdown');
    
    if (settingsDropdown) {
        settingsDropdown.addEventListener('click', (e) => {
            e.preventDefault();
            const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
            settingsModal.show();
        });
    }
    
    if (logoutDropdown) {
        logoutDropdown.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        });
    }
}

// Goals functionality
function initGoalsEvents() {
    const createGoalBtn = document.getElementById('create-goal-btn');
    const saveGoalBtn = document.getElementById('saveGoalBtn');
    const saveProgressBtn = document.getElementById('saveProgressBtn');
    const goalTypeSelect = document.getElementById('goalType');
    
    if (createGoalBtn) {
        createGoalBtn.addEventListener('click', () => {
            const createGoalModal = new bootstrap.Modal(document.getElementById('createGoalModal'));
            
            // Prefill current weight if creating weight-related goal
            if (currentSection === 'nutrition' || currentSection === 'goals') {
                prefillCurrentValues();
            }
            
            createGoalModal.show();
        });
    }
    
    if (goalTypeSelect) {
        goalTypeSelect.addEventListener('change', (e) => {
            updateGoalFormFields();
            // Auto-prefill current values when goal type changes
            if (e.target.value) {
                prefillCurrentValues();
            }
        });
    }
    
    if (saveGoalBtn) {
        saveGoalBtn.addEventListener('click', createGoal);
    }
    
    if (saveProgressBtn) {
        saveProgressBtn.addEventListener('click', updateGoalProgress);
    }
}

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
    
    // Remove required attributes from auto form fields initially
    const autoFormFields = ['autoLogDate', 'autoMealType', 'foodDescription'];
    autoFormFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) field.removeAttribute('required');
    });
    
    // Initialize navigation and mobile menu
    initNavigation();
    initMobileMenu();
    initUserMenu();
    initGoalsEvents();
    initializeFilters();
    initAutoTracking();
    
    // Set default to manual mode (must be done after DOM is ready)
    switchToManualMode();
    
    // Display user info
    const userDisplayName = document.getElementById('user-display-name');
    const userEmailDisplay = document.getElementById('user-email-display');
    const userInitials = document.getElementById('user-initials');
    
    if (userDisplayName && userEmailDisplay && userInitials) {
        userEmailDisplay.textContent = currentUser.email;
        userDisplayName.textContent = currentUser.email.split('@')[0];
        userInitials.textContent = currentUser.email.charAt(0).toUpperCase();
    }
    
    // Set user email in settings modal
    if (settingsUserEmail) {
        settingsUserEmail.textContent = currentUser.email;
    }
    
    // Set default date to current date (no time)
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    
    // Set default values for nutrition inputs
    const logProteinElement = document.getElementById('logProtein');
    const logCaloriesElement = document.getElementById('logCalories');
    const logCarbsElement = document.getElementById('logCarbs');
    const logFatElement = document.getElementById('logFat');
    
    if (logProteinElement) logProteinElement.value = '0';
    if (logCaloriesElement) logCaloriesElement.value = '0';
    if (logCarbsElement) logCarbsElement.value = '0';
    if (logFatElement) logFatElement.value = '0';
    
    // Initialize mobile workout controls
    initMobileWorkoutControls();
    
    // Add event listeners for goal progress display
    const caloriesInput = document.getElementById('logCalories');
    const proteinInput = document.getElementById('logProtein');
    if (caloriesInput && proteinInput) {
        caloriesInput.addEventListener('input', updateGoalProgressDisplay);
        proteinInput.addEventListener('input', updateGoalProgressDisplay);
    }
    
    await loadData();
    await loadWorkoutData();
    await loadGoalsData();
    await loadWeightEntries();
    updateStats();
});

// Logout handler (keep for backward compatibility)
const logoutNav = document.getElementById('logout-nav');
if (logoutNav) {
    logoutNav.addEventListener('click', () => {
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
            } else if (data.weight_logs || data.weight_entries || data.workouts) {
                // New format
                weightLogs = data.weight_logs || [];
                const weightEntries = data.weight_entries || [];
                workouts = data.workouts || [];
                
                // If we have weight entries, import them separately
                if (weightEntries.length > 0) {
                    const weightEntriesResult = await apiCall('/import', {
                        method: 'POST',
                        body: JSON.stringify({ weight_entries: weightEntries })
                    });
                    console.log('Weight entries import result:', weightEntriesResult);
                }
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
if (weightForm) {
    weightForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Only process manual form submission when in manual mode
        if (isAutoMode) {
            console.log('Form submission blocked - currently in auto mode');
            return;
        }
        
        // Check if manual form fields exist and are valid
        const logDateHidden = document.getElementById('logDateHidden');
        const mealType = document.getElementById('mealType');
        const logProtein = document.getElementById('logProtein');
        const logCalories = document.getElementById('logCalories');
        const logCarbs = document.getElementById('logCarbs');
        const logFat = document.getElementById('logFat');
        
        if (!logDateHidden || !mealType || !logProtein || !logCalories || !logCarbs || !logFat) {
            alert('Form elements not found. Please reload the page.');
            return;
        }
        
        if (!logDateHidden.value || !mealType.value || 
            logProtein.value === '' || logCalories.value === '' || 
            logCarbs.value === '' || logFat.value === '') {
            alert('Please fill in all required fields');
            return;
        }
    
        try {
            const mealTypeValue = document.getElementById('mealType').value;
            const customMealName = document.getElementById('customMealName').value;
            
            const formData = {
                log_date: document.getElementById('logDateHidden').value,
                log_protein: parseFloat(document.getElementById('logProtein').value) || 0,
                log_calories: parseFloat(document.getElementById('logCalories').value) || 0,
                log_carbs: parseFloat(document.getElementById('logCarbs').value) || 0,
                log_fat: parseFloat(document.getElementById('logFat').value) || 0,
                log_misc_info: document.getElementById('logMiscInfo').value || "",
                meal_type: mealTypeValue,
                meal_name: mealTypeValue === 'custom' ? customMealName : null
            };

            await apiCall('/weight', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            // Reset form
            weightForm.reset();
            
            // Set default values for numeric inputs
            document.getElementById('logProtein').value = '0';
            document.getElementById('logCalories').value = '0';
            document.getElementById('logCarbs').value = '0';
            document.getElementById('logFat').value = '0';
            document.getElementById('mealType').value = 'breakfast';
            document.getElementById('customMealGroup').style.display = 'none';
            
            // Reset goal progress display
            updateGoalProgressDisplay();
            
            // Reload day data to show new meal
            await loadDayData(currentDate);
            
            // Reload data
            await loadData();
            
            alert('Entry saved successfully!');
        } catch (error) {
            console.error('Error saving data:', error);
            alert('Error saving data: ' + error.message);
        }
    });
}

// Weight entry form submission handler
if (weightEntryForm) {
    weightEntryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const weightDateHidden = document.getElementById('weightDateHidden');
        const weightValue = document.getElementById('weightValue');
        const weightNotes = document.getElementById('weightNotes');
        
        if (!weightDateHidden || !weightValue) {
            alert('Required form elements not found. Please reload the page.');
            return;
        }
        
        if (!weightDateHidden.value || !weightValue.value) {
            alert('Please fill in the required fields.');
            return;
        }
        
        try {
            const formData = {
                log_date: weightDateHidden.value,
                weight: parseFloat(weightValue.value),
                notes: weightNotes ? weightNotes.value || "" : ""
            };

            await apiCall('/weight-entries', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            // Update weight goals if weight was logged
            await updateWeightGoalsProgress(formData.weight);
            
            // Reset form
            weightEntryForm.reset();
            
            // Reload day data to show updated weight
            await loadDayData(currentDate);
            
            await loadData(); // Reload to update charts and display
            updateStats();
            alert('Weight logged successfully!');
        } catch (error) {
            console.error('Error saving weight entry:', error);
            alert('Error saving weight entry: ' + error.message);
        }
    });
}

// Load data from API
async function loadData() {
    try {
        const records = await apiCall('/weight');
        
        // Store all records for filtering (keep for compatibility)
        allRecords = records;
        filteredRecords = [...records];
        
        // Load daily summary for charts
        const summaryData = await apiCall('/weight/daily-summary');
        renderWeightChart();
        renderNutritionChart(summaryData);
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Load weight entries from API
async function loadWeightEntries() {
    try {
        const data = await apiCall('/weight-entries');
        displayRecentWeightEntries(data.slice(0, 5)); // Show last 5 entries
    } catch (error) {
        console.error('Error loading weight entries:', error);
    }
}

// Display recent weight entries
function displayRecentWeightEntries(entries) {
    const container = document.getElementById('recent-weight-entries');
    if (!container) return;
    
    if (entries.length === 0) {
        container.innerHTML = '<p class="text-muted">No recent entries</p>';
        return;
    }
    
    const entriesHtml = entries.map(entry => {
        const date = new Date(entry.log_date).toLocaleDateString();
        return `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
                <div>
                    <strong>${entry.weight} kg</strong>
                    <br><small class="text-muted">${date}</small>
                </div>
                <div class="text-end">
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteWeightEntry(${entry.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = entriesHtml;
}

// Delete weight entry
async function deleteWeightEntry(id) {
    if (confirm('Are you sure you want to delete this weight entry?')) {
        try {
            await apiCall(`/weight-entries/${id}`, { method: 'DELETE' });
            await loadWeightEntries();
            await loadData(); // Reload to update charts
            updateStats();
            alert('Weight entry deleted successfully!');
        } catch (error) {
            console.error('Error deleting weight entry:', error);
            alert('Error deleting weight entry: ' + error.message);
        }
    }
}

// Edit weight entry from history
async function editWeightEntry(id) {
    try {
        const weightData = await apiCall('/weight-entries');
        const entry = weightData.find(w => w.id === id);
        
        if (!entry) {
            alert('Weight entry not found');
            return;
        }
        
        // Configure modal for weight editing
        configureEditModal('weight');
        
        // Populate edit modal with weight data
        document.getElementById('editDate').value = entry.log_date;
        document.getElementById('editWeight').value = entry.weight;
        document.getElementById('editNotes').value = entry.notes || '';
        
        // Store the entry ID for saving
        document.getElementById('editModal').dataset.weightEntryId = id;
        document.getElementById('editModal').dataset.editType = 'weight';
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading weight entry for edit:', error);
        alert('Error loading weight entry');
    }
}

// Delete weight entry from history
async function deleteWeightEntry(id) {
    if (!confirm('Are you sure you want to delete this weight entry?')) {
        return;
    }
    
    try {
        await apiCall(`/weight-entries/${id}`, {
            method: 'DELETE'
        });
        
        // Reload weight history
        loadWeightHistory();
        
        // Update stats
        updateStats();
        
        // Reload weight chart
        renderWeightChart();
        
        alert('Weight entry deleted successfully');
    } catch (error) {
        console.error('Error deleting weight entry:', error);
        alert('Error deleting weight entry');
    }
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
        
        document.getElementById('editMealType').value = record.meal_type || 'full_day';
        document.getElementById('editCustomMealName').value = record.meal_name || '';
        
        // Show/hide custom meal name field
        const customMealGroup = document.getElementById('editCustomMealGroup');
        if (record.meal_type === 'custom') {
            customMealGroup.style.display = 'block';
        } else {
            customMealGroup.style.display = 'none';
        }
        
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
        const mealType = document.getElementById('editMealType').value;
        const customMealName = document.getElementById('editCustomMealName').value;
        
        const formData = {
            log_date: document.getElementById('editDate').value,
            log_protein: parseFloat(document.getElementById('editProtein').value) || 0,
            log_calories: parseFloat(document.getElementById('editCalories').value) || 0,
            log_carbs: parseFloat(document.getElementById('editCarbs').value) || 0,
            log_fat: parseFloat(document.getElementById('editFat').value) || 0,
            log_misc_info: document.getElementById('editMiscInfo').value || "",
            meal_type: mealType,
            meal_name: mealType === 'custom' ? customMealName : null
        };
        
        await apiCall(`/weight/${id}`, {
            method: 'PUT',
            body: JSON.stringify(formData)
        });
        
        // Hide the modal
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
        editModal.hide();
        
        // Reload day data to show new meal
        await loadDayData(currentDate);
        
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
async function renderWeightChart() {
    const ctx = document.getElementById('weightChart').getContext('2d');
    
    try {
        // Fetch weight entries using the apiCall helper
        const weightEntries = await apiCall('/weight-entries');
        
        if (weightEntries.length === 0) {
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
        
        // Sort by date
        weightEntries.sort((a, b) => new Date(a.log_date) - new Date(b.log_date));
        
        // Format data for chart
        const dates = weightEntries.map(entry => {
            const date = new Date(entry.log_date);
            return date.toLocaleDateString();
        });
        
        const weights = weightEntries.map(entry => entry.weight);
        
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
        
    } catch (error) {
        console.error('Error loading weight chart:', error);
        
        // Destroy existing chart if it exists
        if (weightChart) {
            weightChart.destroy();
        }
        
        // Show error message
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#dc3545';
        ctx.fillText('Error loading weight data', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
}

// Render nutrition chart
function renderNutritionChart(items) {
    const ctx = document.getElementById('nutritionChart').getContext('2d');
    
    // Sort items by date first to ensure correct order
    const sortedItems = [...items].sort((a, b) => new Date(a.log_date) - new Date(b.log_date));
    
    // Format data for chart - get last 7 entries
    const recentItems = sortedItems.slice(-7);
    
    const dates = recentItems.map(item => {
        const date = new Date(item.log_date);
        return date.toLocaleDateString();
    });
    
    const proteins = recentItems.map(item => item.total_protein);
    const calories = recentItems.map(item => item.total_calories / 100); // Scale down calories to fit with other metrics
    const carbs = recentItems.map(item => item.total_carbs);
    const fats = recentItems.map(item => item.total_fat);
    
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
            description: header.indexOf('description'),
            exercise_title: header.indexOf('exercise_title'),
            exercise_notes: header.indexOf('exercise_notes'),
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
                    description: columns[columnIndices.description]?.replace(/"/g, '') || '',
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
                duration_seconds: parseInt(columns[columnIndices.duration_seconds]) || null,
                notes: columns[columnIndices.exercise_notes]?.replace(/"/g, '') || ''
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
                const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
                
                // Format date
                const workoutDate = startTime.toISOString().split('T')[0];
                
                // Convert exercises to our format
                const exercisesArray = [];
                for (const [exerciseTitle, sets] of workout.exercises) {
                    exercisesArray.push({
                        title: exerciseTitle,
                        sets: sets.map(set => ({
                            set_index: set.set_index,
                            weight_kg: set.weight_kg,
                            reps: set.reps,
                            duration_seconds: set.duration_seconds,
                            notes: set.notes
                        }))
                    });
                }
                
                const workoutData = {
                    title: workout.title,
                    workout_date: workoutDate,
                    start_time: startTime.toTimeString().split(' ')[0], // Format as HH:MM:SS
                    duration_minutes: durationMinutes,
                    exercises: JSON.stringify(exercisesArray),
                    total_exercises: exercisesArray.length,
                    total_sets: exercisesArray.reduce((total, ex) => total + ex.sets.length, 0),
                    description: workout.description
                };
                
                await apiCall('/workouts', {
                    method: 'POST',
                    body: JSON.stringify(workoutData)
                });
                
                newWorkouts++;
            } catch (error) {
                console.error('Error importing workout:', error);
                skippedWorkouts++;
            }
        }
        
        // Show results
        let message = `Import completed!\nNew workouts imported: ${newWorkouts}`;
        if (skippedWorkouts > 0) {
            message += `\nSkipped (already exists): ${skippedWorkouts}`;
        }
        message += `\n\nNew features imported:\n• Workout descriptions\n• Exercise set notes`;
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
        
        // Calculate total volume
        let totalVolume = 0;
        try {
            const exercises = JSON.parse(item.exercises);
            exercises.forEach(exercise => {
                if (exercise.sets && Array.isArray(exercise.sets)) {
                    exercise.sets.forEach(set => {
                        const weight = parseFloat(set.weight_kg) || 0;
                        const reps = parseInt(set.reps) || 0;
                        totalVolume += weight * reps;
                    });
                }
            });
        } catch (error) {
            // If parsing fails, volume remains 0
        }
        
        // Create workout title with description if available
        let titleDisplay = item.title;
        if (item.description && item.description.trim()) {
            titleDisplay += ` <small class="text-muted">- ${item.description}</small>`;
        }
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="workout-checkbox" value="${item.id}" onchange="updateDeleteButtonState()">
            </td>
            <td>${formattedDate}</td>
            <td>${titleDisplay}</td>
            <td>${duration}</td>
            <td>${item.total_exercises}</td>
            <td>${item.total_sets}</td>
            <td>${totalVolume > 0 ? `${totalVolume.toFixed(1)} kg` : 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewWorkoutDetails('${item.id}')">View Details</button>
                <button class="btn btn-sm btn-danger" onclick="deleteWorkout('${item.id}')">Delete</button>
            </td>
        `;
        
        workoutTableBody.appendChild(row);
    });
    
    // Also render mobile cards
    renderMobileWorkoutCards(items);
    
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
        
        // Calculate total workout volume
        let totalWorkoutVolume = 0;
        exercises.forEach(exercise => {
            if (exercise.sets && exercise.sets.length > 0) {
                exercise.sets.forEach(set => {
                    const weight = parseFloat(set.weight_kg) || 0;
                    const reps = parseInt(set.reps) || 0;
                    totalWorkoutVolume += weight * reps;
                });
            }
        });
        
        let detailsHTML = `<h4>${workout.title}</h4>`;
        detailsHTML += `<p><strong>Date:</strong> ${new Date(workout.workout_date).toLocaleDateString()}</p>`;
        detailsHTML += `<p><strong>Duration:</strong> ${workout.duration_minutes} minutes</p>`;
        detailsHTML += `<p><strong>Total Volume:</strong> ${totalWorkoutVolume > 0 ? `${totalWorkoutVolume.toFixed(1)}` : 'N/A'}</p>`;
        
        // Add workout description if it exists
        if (workout.description && workout.description.trim()) {
            detailsHTML += `<div class="alert alert-info" style="margin: 15px 0;">`;
            detailsHTML += `<h6><i class="fas fa-info-circle me-2"></i>Workout Notes:</h6>`;
            detailsHTML += `<p class="mb-0">${workout.description}</p>`;
            detailsHTML += `</div>`;
        }
        
        detailsHTML += `<h5>Exercises:</h5>`;
        
        exercises.forEach(exercise => {
            // Calculate total volume for this exercise
            let exerciseVolume = 0;
            if (exercise.sets && exercise.sets.length > 0) {
                exercise.sets.forEach(set => {
                    const weight = parseFloat(set.weight_kg) || 0;
                    const reps = parseInt(set.reps) || 0;
                    exerciseVolume += weight * reps;
                });
            }
            
            detailsHTML += `<div class="exercise-section" style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">`;
            detailsHTML += `<h6 style="color: #6366f1; margin-bottom: 10px;">${exercise.title}`;
            if (exerciseVolume > 0) {
                detailsHTML += ` <span style="font-size: 0.8em; color: #666;">(Total Volume: ${exerciseVolume.toFixed(1)})</span>`;
            }
            detailsHTML += `</h6>`;
            
            if (exercise.sets && exercise.sets.length > 0) {
                detailsHTML += `<table class="table table-sm table-striped">`;
                detailsHTML += `<thead><tr><th>Set</th><th>Weight (kg)</th><th>Reps</th><th>Volume (kg)</th><th>Duration (s)</th><th>Notes</th></tr></thead><tbody>`;
                
                exercise.sets.forEach((set, index) => {
                    const weight = parseFloat(set.weight_kg) || 0;
                    const reps = parseInt(set.reps) || 0;
                    const setVolume = weight * reps;
                    
                    detailsHTML += `<tr>`;
                    detailsHTML += `<td>${index + 1}</td>`;
                    detailsHTML += `<td>${set.weight_kg || '-'}</td>`;
                    detailsHTML += `<td>${set.reps || '-'}</td>`;
                    detailsHTML += `<td>${setVolume > 0 ? setVolume.toFixed(1) : '-'}</td>`;
                    detailsHTML += `<td>${set.duration_seconds || '-'}</td>`;
                    detailsHTML += `<td>${set.notes || '-'}</td>`;
                    detailsHTML += `</tr>`;
                });
                
                detailsHTML += `</tbody></table>`;
            }
            
            detailsHTML += `</div>`;
        });
        
        // Create a modal or alert to show details
        const detailsWindow = window.open('', '_blank', 'width=800,height=900,scrollbars=yes');
        detailsWindow.document.write(`
            <html>
                <head>
                    <title>Workout Details</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        body { font-family: 'Inter', sans-serif; }
                        .exercise-section { background: #f8f9fa; }
                        h4 { color: #6366f1; }
                        h6 { border-bottom: 2px solid #e9ecef; padding-bottom: 5px; }
                    </style>
                </head>
                <body class="p-4">
                    ${detailsHTML}
                    <div class="mt-4">
                        <button onclick="window.close()" class="btn btn-secondary">Close</button>
                        <button onclick="window.print()" class="btn btn-primary ms-2">Print</button>
                    </div>
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

// Goals API functions
async function loadGoalsData() {
    try {
        const goals = await apiCall('/goals');
        goalsData = goals;
        displayGoals(goals);
        renderGoalsChart(goals);
        
        // Update goal progress display in data entry form if visible
        updateGoalProgressDisplay();
    } catch (error) {
        console.error('Error loading goals:', error);
    }
}

async function createGoal() {
    try {
        const goalType = document.getElementById('goalType').value;
        
        console.log('Creating goal with type:', goalType);
        
        // Check for existing calorie/protein goals
        if (goalType === 'calorie' || goalType === 'protein') {
            const existingGoal = goalsData.find(g => g.goal_type === goalType && g.status === 'active');
            if (existingGoal) {
                alert(`You already have an active ${goalType === 'calorie' ? 'calorie' : 'protein'} goal. Please delete it first if you want to create a new one.`);
                return;
            }
        }
        
        let goalData;
        
        if (goalType === 'calorie' || goalType === 'protein') {
            // Daily limit goals
            const dailyLimitValue = document.getElementById('dailyLimit').value;
            const titleValue = document.getElementById('goalTitle').value;
            const notesValue = document.getElementById('goalNotes').value;
            
            console.log('Daily limit goal data:', { dailyLimitValue, titleValue, notesValue });
            
            if (!dailyLimitValue || !titleValue) {
                alert('Please fill in the title and daily limit');
                return;
            }
            
            goalData = {
                goal_type: goalType,
                title: titleValue,
                daily_limit: parseFloat(dailyLimitValue),
                notes: notesValue || ''
            };
        } else {
            // Weight-related goals
            const currentValue = document.getElementById('currentValue').value;
            const targetValue = document.getElementById('targetValue').value;
            const targetDate = document.getElementById('targetDate').value;
            const titleValue = document.getElementById('goalTitle').value;
            const notesValue = document.getElementById('goalNotes').value;
            
            console.log('Weight goal data:', { currentValue, targetValue, targetDate, titleValue, notesValue });
            
            if (!currentValue || !targetValue || !targetDate || !titleValue) {
                alert('Please fill in all required fields');
                return;
            }
            
            goalData = {
                goal_type: goalType,
                title: titleValue,
                current_value: parseFloat(currentValue),
                target_value: parseFloat(targetValue),
                target_date: targetDate,
                notes: notesValue || ''
            };
        }
        
        console.log('Sending goal data:', goalData);

        await apiCall('/goals', {
            method: 'POST',
            body: JSON.stringify(goalData)
        });

        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createGoalModal'));
        modal.hide();

        // Reset form
        document.getElementById('create-goal-form').reset();
        updateGoalFormFields(); // Reset form visibility

        // Reload goals
        await loadGoalsData();

        alert('Goal created successfully!');
    } catch (error) {
        console.error('Error creating goal:', error);
        alert('Error creating goal: ' + error.message);
    }
}

async function updateGoalProgress() {
    try {
        const goalId = document.getElementById('progressGoalId').value;
        const progressData = {
            recorded_value: parseFloat(document.getElementById('progressValue').value),
            notes: document.getElementById('progressNotes').value
        };

        await apiCall(`/goals/${goalId}/progress`, {
            method: 'POST',
            body: JSON.stringify(progressData)
        });

        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('updateProgressModal'));
        modal.hide();

        // Reset form
        document.getElementById('update-progress-form').reset();

        // Reload goals
        await loadGoalsData();

        alert('Progress updated successfully!');
    } catch (error) {
        console.error('Error updating progress:', error);
        alert('Error updating progress: ' + error.message);
    }
}

// Display goals in the UI
async function displayGoals(goals) {
    const activeContainer = document.getElementById('active-goals-container');
    const completedContainer = document.getElementById('completed-goals-container');

    // Clear containers
    activeContainer.innerHTML = '';
    completedContainer.innerHTML = '';

    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');

    // Display active goals
    if (activeGoals.length === 0) {
        activeContainer.innerHTML = `
            <div class="no-goals">
                <i class="fas fa-target"></i>
                <h5>No Active Goals</h5>
                <p>Create your first goal to start tracking your progress!</p>
            </div>
        `;
    } else {
        for (const goal of activeGoals) {
            const goalCard = await createGoalCard(goal);
            activeContainer.appendChild(goalCard);
        }
    }

    // Display completed goals
    if (completedGoals.length === 0) {
        completedContainer.innerHTML = `
            <div class="no-goals">
                <i class="fas fa-trophy"></i>
                <h5>No Completed Goals</h5>
                <p>Complete your first goal to see it here!</p>
            </div>
        `;
    } else {
        for (const goal of completedGoals) {
            const goalCard = await createGoalCard(goal);
            completedContainer.appendChild(goalCard);
        }
    }
}

async function createGoalCard(goal) {
    const card = document.createElement('div');
    card.className = `goal-card ${goal.status}`;

    // Get current value based on goal type
    const currentDisplayValue = await getCurrentValueForGoal(goal);
    
    // Calculate actual progress based on goal type
    let progressPercentage = 0;
    if (goal.status === 'completed') {
        progressPercentage = 100;
    } else {
        progressPercentage = await calculateGoalProgressAsync(goal);
    }

    // Format goal type display
    const goalTypeMap = {
        'weight_loss': 'Weight Loss',
        'weight_gain': 'Weight Gain',
        'maintenance': 'Maintenance',
        'calorie': 'Daily Calories',
        'protein': 'Daily Protein'
    };

    // Determine unit
    const unit = goal.goal_type.includes('weight') ? 'kg' : 
                 goal.goal_type === 'protein' ? 'g' : '';

    let valuesSection = '';
    let progressSection = '';

    if (goal.goal_type === 'calorie' || goal.goal_type === 'protein') {
        // For daily limit goals, show different layout
        valuesSection = `
            <div class="goal-values">
                <div class="goal-value">
                    <span class="goal-value-number">${goal.daily_limit}${unit}</span>
                    <span class="goal-value-label">Daily Limit</span>
                </div>
            </div>
        `;
        progressSection = `
            <div class="alert alert-info">
                <small><i class="fas fa-info-circle me-1"></i>Progress is automatically tracked with each nutrition log entry</small>
            </div>
        `;
    } else {
        // For weight-related goals
        const targetDate = new Date(goal.target_date);
        const today = new Date();
        const daysRemaining = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));

        valuesSection = `
            <div class="goal-values">
                <div class="goal-value">
                    <span class="goal-value-number">${currentDisplayValue}${unit}</span>
                    <span class="goal-value-label">Current</span>
                </div>
                <div class="goal-value">
                    <span class="goal-value-number">${goal.target_value}${unit}</span>
                    <span class="goal-value-label">Target</span>
                </div>
                <div class="goal-value">
                    <span class="goal-value-number">${daysRemaining > 0 ? daysRemaining : 0}</span>
                    <span class="goal-value-label">Days Left</span>
                </div>
            </div>
        `;
        progressSection = `
            <div class="goal-progress">
                <div class="goal-progress-label">
                    <span>Progress</span>
                    <span>${progressPercentage.toFixed(1)}%</span>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-fill" style="width: ${progressPercentage}%"></div>
                </div>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="goal-header">
            <div>
                <h4 class="goal-title">${goal.title}</h4>
                <div class="goal-type">${goalTypeMap[goal.goal_type] || goal.goal_type}</div>
            </div>
            <div class="goal-status ${goal.status}">${goal.status}</div>
        </div>

        ${valuesSection}

        ${progressSection}

        ${goal.notes ? `<p style="color: var(--gray-600); font-size: 0.875rem; margin: var(--space-4) 0;">${goal.notes}</p>` : ''}

        <div class="goal-actions">
            ${goal.status === 'active' && (goal.goal_type === 'calorie' || goal.goal_type === 'protein') ? `
                <button class="btn btn-success btn-sm" onclick="completeGoal('${goal.id}')">
                    <i class="fas fa-check"></i> Complete
                </button>
            ` : goal.status === 'active' ? `
                <button class="btn btn-success btn-sm" onclick="completeGoal('${goal.id}')">
                    <i class="fas fa-check"></i> Complete
                </button>
            ` : ''}
            <button class="btn btn-danger btn-sm" onclick="deleteGoal('${goal.id}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;

    return card;
}

function updateProgress(goalId) {
    document.getElementById('progressGoalId').value = goalId;
    const modal = new bootstrap.Modal(document.getElementById('updateProgressModal'));
    modal.show();
}

async function completeGoal(goalId) {
    if (confirm('Are you sure you want to mark this goal as completed?')) {
        try {
            await apiCall(`/goals/${goalId}/complete`, {
                method: 'POST',
                body: JSON.stringify({})
            });

            await loadGoalsData();
            alert('Goal completed! Congratulations!');
        } catch (error) {
            console.error('Error completing goal:', error);
            alert('Error completing goal: ' + error.message);
        }
    }
}

async function deleteGoal(goalId) {
    if (confirm('Are you sure you want to delete this goal?')) {
        try {
            await apiCall(`/goals/${goalId}`, {
                method: 'DELETE'
            });

            await loadGoalsData();
            alert('Goal deleted successfully!');
        } catch (error) {
            console.error('Error deleting goal:', error);
            alert('Error deleting goal: ' + error.message);
        }
    }
}

async function renderGoalsChart(goals) {
    const ctx = document.getElementById('goalsChart').getContext('2d');
    
    if (goals.length === 0) {
        // Destroy existing chart if it exists
        if (goalsChart) {
            goalsChart.destroy();
        }
        
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        ctx.fillText('No goals data to display', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    // Prepare data for active goals
    const activeGoals = goals.filter(g => g.status === 'active');
    const labels = activeGoals.map(g => g.title);
    
    // Calculate progress for each goal
    const progressData = [];
    for (const goal of activeGoals) {
        const progress = await calculateGoalProgressAsync(goal);
        progressData.push(progress);
    }

    // Destroy existing chart if it exists
    if (goalsChart) {
        goalsChart.destroy();
    }

    // Create new chart
    goalsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Progress %',
                data: progressData,
                backgroundColor: [
                    'rgba(37, 99, 235, 0.8)',
                    'rgba(5, 150, 105, 0.8)',
                    'rgba(217, 119, 6, 0.8)',
                    'rgba(220, 38, 38, 0.8)',
                    'rgba(147, 51, 234, 0.8)'
                ],
                borderColor: [
                    'rgba(37, 99, 235, 1)',
                    'rgba(5, 150, 105, 1)',
                    'rgba(217, 119, 6, 1)',
                    'rgba(220, 38, 38, 1)',
                    'rgba(147, 51, 234, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });
}

// Update statistics display
async function updateStats() {
    try {
        const records = await apiCall('/weight');
        const weightEntries = await apiCall('/weight-entries');
        
        if (records.length === 0) {
            return;
        }

        // Get current weight from weight entries
        const currentWeightElement = document.getElementById('current-weight');
        if (currentWeightElement) {
            if (weightEntries.length > 0) {
                const latestWeight = weightEntries[weightEntries.length - 1];
                currentWeightElement.textContent = `${latestWeight.weight} kg`;
            } else {
                currentWeightElement.textContent = '--';
            }
        }

        // Calculate weight change
        const weightChangeElement = document.getElementById('weight-change');
        if (weightChangeElement && weightEntries.length >= 2) {
            const previousWeight = weightEntries[weightEntries.length - 2].weight;
            const currentWeight = weightEntries[weightEntries.length - 1].weight;
            
            const change = currentWeight - previousWeight;
            const changeText = change >= 0 ? `+${change.toFixed(1)} kg` : `${change.toFixed(1)} kg`;
            weightChangeElement.textContent = changeText;
            weightChangeElement.className = change >= 0 ? 'stat-change positive' : 'stat-change negative';
        }

        // Calculate average calories (last 7 days)
        const avgCaloriesElement = document.getElementById('avg-calories');
        if (avgCaloriesElement) {
            const recentRecords = records.slice(-7);
            const totalCalories = recentRecords.reduce((sum, record) => sum + (record.log_calories || 0), 0);
            const avgCalories = recentRecords.length > 0 ? totalCalories / recentRecords.length : 0;
            avgCaloriesElement.textContent = avgCalories > 0 ? Math.round(avgCalories) : '--';
        }

        // Calculate average protein (last 7 days)
        const avgProteinElement = document.getElementById('avg-protein');
        if (avgProteinElement) {
            const recentRecords = records.slice(-7);
            const totalProtein = recentRecords.reduce((sum, record) => sum + (record.log_protein || 0), 0);
            const avgProtein = recentRecords.length > 0 ? totalProtein / recentRecords.length : 0;
            avgProteinElement.textContent = avgProtein > 0 ? `${Math.round(avgProtein)}g` : '--';
        }

    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

function updateGoalFormFields() {
    const goalType = document.getElementById('goalType').value;
    const currentValueGroup = document.getElementById('currentValueGroup');
    const targetValueGroup = document.getElementById('targetValueGroup');
    const targetDateGroup = document.getElementById('targetDateGroup');
    const dailyLimitGroup = document.getElementById('dailyLimitGroup');
    const currentHelper = document.getElementById('currentValueHelper');
    const targetHelper = document.getElementById('targetValueHelper');
    
    // Get form elements to manage required attribute
    const currentValueInput = document.getElementById('currentValue');
    const targetValueInput = document.getElementById('targetValue');
    const targetDateInput = document.getElementById('targetDate');
    const dailyLimitInput = document.getElementById('dailyLimit');

    // Hide all groups first and remove required attributes
    currentValueGroup.style.display = 'none';
    targetValueGroup.style.display = 'none';
       targetDateGroup.style.display = 'none';
    dailyLimitGroup.style.display = 'none';
    
    if (currentValueInput) currentValueInput.removeAttribute('required');
    if (targetValueInput) targetValueInput.removeAttribute('required');
    if (targetDateInput) targetDateInput.removeAttribute('required');
    if (dailyLimitInput) dailyLimitInput.removeAttribute('required');

    switch (goalType) {
        case 'weight_loss':
        case 'weight_gain':
        case 'maintenance':
            currentValueGroup.style.display = 'block';
            targetValueGroup.style.display = 'block';
            targetDateGroup.style.display = 'block';
            currentHelper.textContent = 'Current weight (kg)';
            targetHelper.textContent = 'Target weight (kg)';
            
            // Set required attributes
            if (currentValueInput) currentValueInput.setAttribute('required', 'required');
            if (targetValueInput) targetValueInput.setAttribute('required', 'required');
            if (targetDateInput) targetDateInput.setAttribute('required', 'required');
            break;
        case 'calorie':
        case 'protein':
            dailyLimitGroup.style.display = 'block';
            const limitHelper = document.getElementById('dailyLimitHelper');
            if (limitHelper) {
                limitHelper.textContent = goalType === 'calorie' ? 'Daily calorie limit' : 'Daily protein limit (g)';
            }
            
            // Set required attribute
            if (dailyLimitInput) dailyLimitInput.setAttribute('required', 'required');
            break;
        default:
            currentValueGroup.style.display = 'block';
            targetValueGroup.style.display = 'block';
            targetDateGroup.style.display = 'block';
            currentHelper.textContent = 'Current value';
            targetHelper.textContent = 'Target value';
            
            // Set required attributes
            if (currentValueInput) currentValueInput.setAttribute('required', 'required');
            if (targetValueInput) targetValueInput.setAttribute('required', 'required');
            if (targetDateInput) targetDateInput.setAttribute('required', 'required');
    }
}

async function prefillCurrentValues() {
    try {
        const weightEntries = await apiCall('/weight-entries');
        if (weightEntries.length > 0) {
            const latestWeight = weightEntries[weightEntries.length - 1];
            const currentValueInput = document.getElementById('currentValue');
            if (currentValueInput) {
                currentValueInput.value = latestWeight.weight;
            }
        }
    } catch (error) {
        // Prefill failed, user can enter manually
    }
}

// Global functions for goal management
window.updateProgress = updateProgress;
window.completeGoal = completeGoal;
window.deleteGoal = deleteGoal;

// Mobile workout controls
function initMobileWorkoutControls() {
    const selectAllMobile = document.getElementById('select-all-workouts-mobile');
    
    if (selectAllMobile) {
        selectAllMobile.addEventListener('change', (e) => {
            const workoutCards = document.querySelectorAll('.workout-card');
            workoutCards.forEach(card => {
                if (e.target.checked) {
                    card.classList.add('selected');
                    selectedWorkouts.add(card.dataset.workoutId);
                } else {
                    card.classList.remove('selected');
                    selectedWorkouts.delete(card.dataset.workoutId);
                }
            });
            updateDeleteButtonState();
        });
    }
}

function renderMobileWorkoutCards(items) {
    const cardsContainer = document.getElementById('workout-cards-body');
    if (!cardsContainer) return;
    
    cardsContainer.innerHTML = '';
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'workout-card';
        card.dataset.workoutId = item.id;
        
        // Format date
        const date = new Date(item.workout_date);
        const formattedDate = date.toLocaleDateString();
        const duration = `${item.duration_minutes} min`;
        
        // Calculate total volume
        let totalVolume = 0;
        try {
            const exercises = JSON.parse(item.exercises);
            exercises.forEach(exercise => {
                if (exercise.sets && Array.isArray(exercise.sets)) {
                    exercise.sets.forEach(set => {
                        const weight = parseFloat(set.weight_kg) || 0;
                        const reps = parseInt(set.reps) || 0;
                        totalVolume += weight * reps;
                    });
                }
            });
        } catch (error) {
            // If parsing fails, volume remains 0
        }
        
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <h6 class="mb-1">${item.title}</h6>
                    <small class="text-muted">${formattedDate}</small>
                </div>
                <div class="text-end">
                    <small class="text-muted">${duration}</small>
                </div>
            </div>
            <div class="row g-2 mb-3">
                <div class="col-4">
                    <div class="text-center">
                        <div class="fw-bold">${item.total_exercises}</div>
                        <small class="text-muted">Exercises</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="text-center">
                        <div class="fw-bold">${item.total_sets}</div>
                        <small class="text-muted">Sets</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="text-center">
                        <div class="fw-bold">${totalVolume > 0 ? `${totalVolume.toFixed(0)}kg` : 'N/A'}</div>
                        <small class="text-muted">Volume</small>
                    </div>
                </div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-primary flex-fill" onclick="viewWorkoutDetails('${item.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteWorkout('${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Add click handler for selection
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return; // Don't select when clicking buttons
            
            card.classList.toggle('selected');
            if (card.classList.contains('selected')) {
                selectedWorkouts.add(item.id);
            } else {
                selectedWorkouts.delete(item.id);
            }
            updateDeleteButtonState();
        });
        
        cardsContainer.appendChild(card);
    });
}

// Meal type event handlers
document.addEventListener('DOMContentLoaded', () => {
    // Add meal type change handler
    const mealTypeSelect = document.getElementById('mealType');
    const customMealGroup = document.getElementById('customMealGroup');
    
    if (mealTypeSelect && customMealGroup) {
        mealTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customMealGroup.style.display = 'block';
                document.getElementById('customMealName').required = true;
            } else {
                customMealGroup.style.display = 'none';
                document.getElementById('customMealName').required = false;
            }
        });
    }
    
    // Add edit meal type change handler
    const editMealTypeSelect = document.getElementById('editMealType');
    const editCustomMealGroup = document.getElementById('editCustomMealGroup');
    
    if (editMealTypeSelect && editCustomMealGroup) {
        editMealTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                editCustomMealGroup.style.display = 'block';
                document.getElementById('editCustomMealName').required = true;
            } else {
                editCustomMealGroup.style.display = 'none';
                document.getElementById('editCustomMealName').required = false;
            }
        });
    }
});

// View day function
async function viewDay(date) {
    try {
        const dayData = await apiCall(`/weight/day/${date}`);
        const goals = await apiCall('/goals');
        
        // Calculate daily totals
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let weight = null;
        
        dayData.forEach(entry => {
            totalCalories += entry.log_calories || 0;
            totalProtein += entry.log_protein || 0;
            totalCarbs += entry.log_carbs || 0;
            totalFat += entry.log_fat || 0;
            if (entry.log_weight) weight = entry.log_weight;
        });
        
        // Find active goals
        const calorieGoal = goals.find(g => g.goal_type === 'calorie' && g.status === 'active');
        const proteinGoal = goals.find(g => g.goal_type === 'protein' && g.status === 'active');
        
        // Create day view HTML
        let goalProgressHTML = '';
        if (calorieGoal) {
            const calorieProgress = (totalCalories / calorieGoal.daily_limit) * 100;
            const calorieStatus = calorieProgress >= 100 ? 'success' : calorieProgress >= 80 ? 'warning' : 'danger';
            const statusText = calorieProgress >= 100 ? 'Goal met!' : `${(100 - calorieProgress).toFixed(1)}% to goal`;
            goalProgressHTML += `
                <div class="mb-3">
                    <div class="d-flex justify-content-between">
                        <div>
                            <strong>Calorie Goal</strong>
                            <div class="progress" style="height: 10px;">
                                <div class="progress-bar bg-${calorieStatus}" role="progressbar" style="width: ${Math.min(calorieProgress, 100)}%" aria-valuenow="${calorieProgress}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                        <div class="text-end">
                            <span class="text-${calorieStatus} fw-bold">${totalCalories.toFixed(0)} / ${calorieGoal.daily_limit}</span>
                        </div>
                    </div>
                    <div class="text-muted" style="font-size: 0.875rem;">
                        ${statusText}
                    </div>
                </div>
            `;
        }
        
        if (proteinGoal) {
            const proteinProgress = (totalProtein / proteinGoal.daily_limit) * 100;
            const proteinStatus = proteinProgress >= 100 ? 'success' : proteinProgress >= 80 ? 'warning' : 'danger';
            const statusText = proteinProgress >= 100 ? 'Goal met!' : `${(100 - proteinProgress).toFixed(1)}% to goal`;
            goalProgressHTML += `
                <div class="mb-3">
                    <div class="d-flex justify-content-between">
                        <div>
                            <strong>Protein Goal</strong>
                            <div class="progress" style="height: 10px;">
                                <div class="progress-bar bg-${proteinStatus}" role="progressbar" style="width: ${Math.min(proteinProgress, 100)}%" aria-valuenow="${proteinProgress}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                        <div class="text-end">
                            <span class="text-${proteinStatus} fw-bold">${totalProtein.toFixed(1)}g / ${proteinGoal.daily_limit}g</span>
                        </div>
                    </div>
                    <div class="text-muted" style="font-size: 0.875rem;">
                        ${statusText}
                    </div>
                </div>
            `;
        }
        
        let mealsHTML = '';
        if (dayData.length === 0) {
            mealsHTML = '<p class="text-muted">No entries for this day.</p>';
        } else {
            mealsHTML = '<div class="table-responsive"><table class="table table-sm">';
            mealsHTML += '<thead><tr><th>Meal</th><th>Protein</th><th>Calories</th><th>Carbs</th><th>Fat</th><th>Notes</th></tr></thead><tbody>';
            
            dayData.forEach(entry => {
                let mealDisplay = '';
                if (entry.meal_type === 'custom' && entry.meal_name) {
                    mealDisplay = entry.meal_name;
                } else {
                    const mealTypes = {
                        'breakfast': 'Breakfast',
                        'lunch': 'Lunch', 
                        'dinner': 'Dinner',
                        'morning_snack': 'Morning Snack',
                        'evening_snack': 'Evening Snack',
                        'full_day': 'Full Day'
                    };
                    mealDisplay = mealTypes[entry.meal_type] || entry.meal_type;
                }
                
                mealsHTML += `
                    <tr>
                        <td>${mealDisplay}</td>
                        <td>${entry.log_protein}g</td>
                        <td>${entry.log_calories}</td>
                        <td>${entry.log_carbs}g</td>
                        <td>${entry.log_fat}g</td>
                        <td>${entry.log_misc_info || '-'}</td>
                    </tr>
                `;
            });
            
            mealsHTML += '</tbody></table></div>';
        }
        
        const dayWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
        dayWindow.document.write(`
            <html>
                <head>
                    <title>Day View - ${date}</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 20px; }
                        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
                        .metric { text-align: center; }
                        .metric-value { font-size: 2rem; font-weight: bold; color: #2563eb; }
                        .metric-label { color: #6c757d; font-size: 0.9rem; }
                        h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <h1>Daily Summary - ${new Date(date).toLocaleDateString()}</h1>
                    
                    ${weight ? `<div class="alert alert-info"><strong>Weight:</strong> ${weight}kg</div>` : ''}
                    
                    <div class="summary-card">
                        <div class="row">
                            <div class="col-md-3 metric">
                                <div class="metric-value">${totalCalories.toFixed(0)}</div>
                                <div class="metric-label">Total Calories</div>
                            </div>
                            <div class="col-md-3 metric">
                                <div class="metric-value">${totalProtein.toFixed(1)}</div>
                                <div class="metric-label">Protein (g)</div>
                            </div>
                            <div class="col-md-3 metric">
                                <div class="metric-value">${totalCarbs.toFixed(1)}</div>
                                <div class="metric-label">Carbs (g)</div>
                            </div>
                            <div class="col-md-3 metric">
                                <div class="metric-value">${totalFat.toFixed(1)}</div>
                                <div class="metric-label">Fat (g)</div>
                            </div>
                        </div>
                    </div>
                    
                    ${goalProgressHTML ? `<h3>Goal Progress</h3>${goalProgressHTML}` : ''}
                    
                    <h3>Meal Breakdown</h3>
                    ${mealsHTML}
                    
                    <div class="mt-4">
                        <button onclick="window.close()" class="btn btn-secondary">Close</button>
                        <button onclick="window.print()" class="btn btn-primary ms-2">Print</button>
                    </div>
                </body>
            </html>
        `);
        
    } catch (error) {
        console.error('Error loading day view:', error);
        alert('Error loading day view: ' + error.message);
    }
}

// Make viewDay globally available
window.viewDay = viewDay;

// Calculate goal progress asynchronously
async function calculateGoalProgressAsync(goal) {
    try {
        // For daily limit goals (calorie/protein), progress is tracked differently
        if (goal.goal_type === 'calorie' || goal.goal_type === 'protein') {
            // For daily limit goals, we could track compliance over time
            // For now, return 0 as these are tracked per day
            return 0;
        }
        
        // For weight goals, fetch goal progress entries
        const data = await apiCall(`/goals/${goal.id}/progress`);
        if (Array.isArray(data) && data.length > 0) {
            const latestProgress = data[data.length - 1];
            return latestProgress.progress_percentage || 0;
        }
        
        // Fallback calculation based on current and target values
        if (goal.current_value != null && goal.target_value != null) {
            const totalChange = goal.target_value - goal.current_value;
            if (totalChange === 0) return 100; // Already at target
            
            // For now, return 0 since we don't have current progress
            return 0;
        }
        
        return 0;
    } catch (error) {
        console.error('Error calculating goal progress:', error);
        return 0;
    }
}

// Get current value for goal
async function getCurrentValueForGoal(goal) {
    try {
        // For daily limit goals, return the limit value
        if (goal.goal_type === 'calorie' || goal.goal_type === 'protein') {
            return goal.daily_limit || 0;
        }
        
        // For weight goals, fetch progress to determine latest recorded value
        const data = await apiCall(`/goals/${goal.id}/progress`);
        if (Array.isArray(data) && data.length > 0) {
            const latestProgress = data[data.length - 1];
            return latestProgress.recorded_value || goal.current_value || 0;
        }
        
        // Fallback: for weight goals, get latest weight from weight entries
        if (goal.goal_type === 'weight_loss' || goal.goal_type === 'weight_gain' || goal.goal_type === 'maintenance') {
            const weightEntries = await apiCall('/weight-entries');
            if (weightEntries.length > 0) {
                const latestWeight = weightEntries[weightEntries.length - 1];
                return latestWeight.weight || goal.current_value || 0;
            }
        }
        
        return goal.current_value || 0;
    } catch (error) {
        console.error('Error getting current value for goal:', error);
        return goal.current_value || goal.daily_limit || 0;
    }
}

// Update goal progress display in data entry form
function updateGoalProgressDisplay() {
    const caloriesInput = document.getElementById('logCalories');
    const proteinInput = document.getElementById('logProtein');
    
    if (!caloriesInput || !proteinInput) return;
    
    const calories = parseFloat(caloriesInput.value) || 0;
    const protein = parseFloat(proteinInput.value) || 0;
    
    // Find active calorie and protein goals
    const calorieGoal = goalsData.find(g => g.goal_type === 'calorie' && g.status === 'active');
    const proteinGoal = goalsData.find(g => g.goal_type === 'protein' && g.status === 'active');
    
    // This function can be enhanced later to show progress inline
    // For now, the goals progress is shown in the daily overview section
}

// Filtering functionality
let allRecords = []; // Store all records for filtering
let filteredRecords = []; // Store filtered records

// Initialize filter functionality - no longer used but kept for compatibility
function initializeFilters() {
    // Filters removed with history section
}

// Apply filters to the data
function applyFilters() {
    const filters = {
        mealType: document.getElementById('filterMealType')?.value || '',
        dateFrom: document.getElementById('filterDateFrom')?.value || '',
        dateTo: document.getElementById('filterDateTo')?.value || '',
        minCalories: parseFloat(document.getElementById('filterMinCalories')?.value) || 0,
        maxCalories: parseFloat(document.getElementById('filterMaxCalories')?.value) || 99999,
        minProtein: parseFloat(document.getElementById('filterMinProtein')?.value) || 0,
        searchNotes: document.getElementById('filterSearchNotes')?.value.toLowerCase() || ''
    };
    
    filteredRecords = allRecords.filter(record => {
        // Meal type filter
        if (filters.mealType && record.meal_type !== filters.mealType) {
            return false;
        }
        
        // Date range filter
        if (filters.dateFrom && record.log_date < filters.dateFrom) {
            return false;
        }
        if (filters.dateTo && record.log_date > filters.dateTo) {
            return false;
        }
        
        // Note: Weight filter removed since weight is now tracked separately
        
        // Calorie range filter
        const calories = record.log_calories || 0;
        if (calories < filters.minCalories || calories > filters.maxCalories) {
            return false;
        }
        
        // Protein filter
        const protein = record.log_protein || 0;
        if (protein < filters.minProtein) {
            return false;
        }
        
        // Notes search filter
        if (filters.searchNotes && 
            (!record.log_misc_info || 
             !record.log_misc_info.toLowerCase().includes(filters.searchNotes))) {
            return false;
        }
        
        return true;
    });
    
    // Update the table display
    displayTableData(filteredRecords);
    
    // Update filter results count
    updateFilterResultsCount();
}

// Clear all filters
function clearFilters() {
    const filterInputs = [
        'filterMealType', 'filterDateFrom', 'filterDateTo',
        'filterMinCalories', 'filterMaxCalories', 'filterMinProtein', 'filterSearchNotes'
    ];
    
    filterInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            if (input.type === 'select-one') {
                input.selectedIndex = 0;
            } else {
                input.value = '';
            }
        }
    });
    
    // Reset filtered records to all records
    filteredRecords = [...allRecords];
    displayTableData(filteredRecords);
    updateFilterResultsCount();
}

// Update filter results count display
function updateFilterResultsCount() {
    const countElement = document.getElementById('filterResultsCount');
    if (countElement) {
        const filteredCount = filteredRecords.length;
        const totalCount = allRecords.length;
        
        if (filteredCount === totalCount) {
            countElement.textContent = `Showing all ${totalCount} entries`;
        } else {
            countElement.textContent = `Showing ${filteredCount} of ${totalCount} entries`;
        }
    }
}

// Export filtered data
async function exportFilteredData() {
    try {
        if (filteredRecords.length === 0) {
            alert('No entries to export with current filters');
            return;
        }
        
        // Create export data structure
        const exportData = {
            weight_logs: filteredRecords,
            workouts: [], // Empty for filtered nutrition export
            export_info: {
                exported_at: new Date().toISOString(),
                filter_applied: true,
                total_records: filteredRecords.length,
                filters_used: getActiveFilters()
            }
        };
        
        // Convert to JSON
        const dataStr = JSON.stringify(exportData, null, 2);
        
        // Create a download link
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        // Create a date string for the filename
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        
        // Create and click a temporary download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `filtered-nutrition-data-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
        
    } catch (error) {
        console.error('Error exporting filtered data:', error);
        alert('Error exporting filtered data: ' + error.message);
    }
}

// Get active filters for export info
function getActiveFilters() {
    const filters = {};
    
    const mealType = document.getElementById('filterMealType')?.value;
    if (mealType) filters.meal_type = mealType;
    
    const dateFrom = document.getElementById('filterDateFrom')?.value;
    if (dateFrom) filters.date_from = dateFrom;
    
    const dateTo = document.getElementById('filterDateTo')?.value;
    if (dateTo) filters.date_to = dateTo;
    
    const minCalories = document.getElementById('filterMinCalories')?.value;
    if (minCalories) filters.min_calories = parseFloat(minCalories);
    
    const maxCalories = document.getElementById('filterMaxCalories')?.value;
    if (maxCalories) filters.max_calories = parseFloat(maxCalories);
    
    const minProtein = document.getElementById('filterMinProtein')?.value;
    if (minProtein) filters.min_protein = parseFloat(minProtein);
    
    const searchNotes = document.getElementById('filterSearchNotes')?.value;
    if (searchNotes) filters.search_notes = searchNotes;
    
    return filters;
}

// Auto-tracking functionality
let isAutoMode = false;
let pendingAIAnalysis = null;

// Initialize auto-tracking events
function initAutoTracking() {
    const manualModeBtn = document.getElementById('manual-mode-btn');
    const autoModeBtn = document.getElementById('auto-mode-btn');
    const manualForm = document.getElementById('manual-entry-form');
    const autoForm = document.getElementById('auto-entry-form');
    const analyzeFoodBtn = document.getElementById('analyze-food-btn');
    const confirmAIBtn = document.getElementById('confirm-ai-analysis');
    const editAIBtn = document.getElementById('edit-ai-analysis');
    const cancelAIBtn = document.getElementById('cancel-ai-analysis');
    const autoMealTypeSelect = document.getElementById('autoMealType');
    const autoCustomMealGroup = document.getElementById('autoCustomMealGroup');
    const manualSubmitBtn = document.getElementById('manual-submit-btn');
    
    // Mode switching
    if (manualModeBtn && autoModeBtn) {
        manualModeBtn.addEventListener('click', () => {
            switchToManualMode();
        });
        
        autoModeBtn.addEventListener('click', () => {
            switchToAutoMode();
        });
    }
    
    // Auto meal type handler
    if (autoMealTypeSelect && autoCustomMealGroup) {
        autoMealTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                autoCustomMealGroup.style.display = 'block';
            } else {
                autoCustomMealGroup.style.display = 'none';
            }
        });
    }
    
    // AI analysis
    if (analyzeFoodBtn) {
        analyzeFoodBtn.addEventListener('click', analyzeFood);
    }
    
    if (confirmAIBtn) {
        confirmAIBtn.addEventListener('click', confirmAIAnalysis);
    }
    
    if (editAIBtn) {
        editAIBtn.addEventListener('click', editAIAnalysis);
    }
    
    if (cancelAIBtn) {
        cancelAIBtn.addEventListener('click', cancelAIAnalysis);
    }
    
    // Set default to manual mode
    switchToManualMode();
}

function switchToManualMode() {
    isAutoMode = false;
    const manualModeBtn = document.getElementById('manual-mode-btn');
    const autoModeBtn = document.getElementById('auto-mode-btn');
    const manualForm = document.getElementById('manual-entry-form');
    const autoForm = document.getElementById('auto-entry-form');
    const aiResults = document.getElementById('ai-results');
    const manualSubmitBtn = document.getElementById('manual-submit-btn');
    const foodDescription = document.getElementById('foodDescription');
    const autoLogDate = document.getElementById('autoLogDate');
    const autoMealType = document.getElementById('autoMealType');
    
    if (manualModeBtn) {
        manualModeBtn.classList.remove('btn-outline-primary');
        manualModeBtn.classList.add('btn-primary');
    }
    
    if (autoModeBtn) {
        autoModeBtn.classList.remove('btn-primary');
        autoModeBtn.classList.add('btn-outline-primary');
    }
    
    if (manualForm) manualForm.style.display = 'block';
    if (autoForm) autoForm.style.display = 'none';
    if (aiResults) aiResults.style.display = 'none';
    if (manualSubmitBtn) manualSubmitBtn.style.display = 'block';
    
    // Remove required attribute from auto form fields
    if (foodDescription) foodDescription.removeAttribute('required');
    if (autoLogDate) autoLogDate.removeAttribute('required');
    if (autoMealType) autoMealType.removeAttribute('required');
    
    // Add required attribute to manual form fields
    const logDate = document.getElementById('logDate');
    const mealType = document.getElementById('mealType');
    const logProtein = document.getElementById('logProtein');
    const logCalories = document.getElementById('logCalories');
    const logCarbs = document.getElementById('logCarbs');
    const logFat = document.getElementById('logFat');
    
    if (logDate) logDate.setAttribute('required', 'required');
    if (mealType) mealType.setAttribute('required', 'required');
    if (logProtein) logProtein.setAttribute('required', 'required');
    if (logCalories) logCalories.setAttribute('required', 'required');
    if (logCarbs) logCarbs.setAttribute('required', 'required');
    if (logFat) logFat.setAttribute('required', 'required');
    
    // Clear any pending AI analysis
    pendingAIAnalysis = null;
}

function switchToAutoMode() {
    isAutoMode = true;
    const manualModeBtn = document.getElementById('manual-mode-btn');
    const autoModeBtn = document.getElementById('auto-mode-btn');
    const manualForm = document.getElementById('manual-entry-form');
    const autoForm = document.getElementById('auto-entry-form');
    const aiResults = document.getElementById('ai-results');
    const manualSubmitBtn = document.getElementById('manual-submit-btn');
    const foodDescription = document.getElementById('foodDescription');
    const autoLogDate = document.getElementById('autoLogDate');
    const autoMealType = document.getElementById('autoMealType');
    
    if (manualModeBtn) {
        manualModeBtn.classList.remove('btn-primary');
        manualModeBtn.classList.add('btn-outline-primary');
    }
    
    if (autoModeBtn) {
        autoModeBtn.classList.remove('btn-outline-primary');
        autoModeBtn.classList.add('btn-primary');
    }
    
    if (manualForm) manualForm.style.display = 'none';
    if (autoForm) autoForm.style.display = 'block';
    if (aiResults) aiResults.style.display = 'none';
    if (manualSubmitBtn) manualSubmitBtn.style.display = 'none';
    
    // Remove required attribute from manual form fields
    const logDate = document.getElementById('logDate');
    const mealType = document.getElementById('mealType');
    const logProtein = document.getElementById('logProtein');
    const logCalories = document.getElementById('logCalories');
    const logCarbs = document.getElementById('logCarbs');
    const logFat = document.getElementById('logFat');
    
    if (logDate) logDate.removeAttribute('required');
    if (mealType) mealType.removeAttribute('required');
    if (logProtein) logProtein.removeAttribute('required');
    if (logCalories) logCalories.removeAttribute('required');
    if (logCarbs) logCarbs.removeAttribute('required');
    if (logFat) logFat.removeAttribute('required');
    
    // Add required attribute to auto form fields
    if (foodDescription) foodDescription.setAttribute('required', 'required');
    if (autoLogDate) autoLogDate.setAttribute('required', 'required');
    if (autoMealType) autoMealType.setAttribute('required', 'required');
    
    // Set current date for auto form
    if (autoLogDate) {
        const now = new Date();
        autoLogDate.value = now.toISOString().split('T')[0];
    }
}

async function analyzeFood() {
    const foodDescription = document.getElementById('foodDescription').value.trim();
    const mealType = document.getElementById('autoMealType').value;
    const analyzeFoodBtn = document.getElementById('analyze-food-btn');
    
        if (!foodDescription) {
            alert('Please describe what you ate');
            document.getElementById('foodDescription').focus();
            return;
        }    // Show loading state
    if (analyzeFoodBtn) {
        analyzeFoodBtn.disabled = true;
        analyzeFoodBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    }
    
    try {
        const response = await apiCall('/analyze-nutrition', {
            method: 'POST',
            body: JSON.stringify({
                description: foodDescription,
                mealType: mealType
            })
        });
        
        if (response.success) {
            displayAIResults(response.nutrition, response.originalDescription);
        } else {
            throw new Error(response.error || 'Analysis failed');
        }
        
    } catch (error) {
        console.error('Error analyzing food:', error);
        alert('Failed to analyze food: ' + error.message);
    } finally {
        // Reset button
        if (analyzeFoodBtn) {
            analyzeFoodBtn.disabled = false;
            analyzeFoodBtn.innerHTML = '<i class="fas fa-brain"></i> Analyze with AI';
        }
    }
}

function displayAIResults(nutrition, originalDescription) {
    const aiResults = document.getElementById('ai-results');
    const aiAnalysisNotes = document.getElementById('ai-analysis-notes');
    const aiProtein = document.getElementById('aiProtein');
    const aiCalories = document.getElementById('aiCalories');
    const aiCarbs = document.getElementById('aiCarbs');
    const aiFat = document.getElementById('aiFat');
    const aiNotes = document.getElementById('aiNotes');
    
    // Store the analysis for later use
    pendingAIAnalysis = {
        ...nutrition,
        originalDescription
    };
    
    // Display results
    if (aiAnalysisNotes) aiAnalysisNotes.textContent = nutrition.notes || 'AI analysis completed';
    if (aiProtein) aiProtein.value = nutrition.log_protein;
    if (aiCalories) aiCalories.value = nutrition.log_calories;
    if (aiCarbs) aiCarbs.value = nutrition.log_carbs;
    if (aiFat) aiFat.value = nutrition.log_fat;
    if (aiNotes) aiNotes.value = nutrition.notes || '';
    
    if (aiResults) {
        aiResults.style.display = 'block';
        aiResults.scrollIntoView({ behavior: 'smooth' });
    }
}

async function confirmAIAnalysis() {
    if (!pendingAIAnalysis) {
        alert('No analysis to confirm');
        return;
    }
    
    try {
        const autoMealType = document.getElementById('autoMealType');
        const autoCustomMealName = document.getElementById('autoCustomMealName');
        const logDateHidden = document.getElementById('logDateHidden');
        
        if (!autoMealType || !logDateHidden) {
            alert('Required form elements not found. Please reload the page.');
            return;
        }
        
        // Get the current values from the AI results (in case user edited them)
        const aiProtein = parseFloat(document.getElementById('aiProtein')?.value) || 0;
        const aiCalories = parseFloat(document.getElementById('aiCalories')?.value) || 0;
        const aiCarbs = parseFloat(document.getElementById('aiCarbs')?.value) || 0;
        const aiFat = parseFloat(document.getElementById('aiFat')?.value) || 0;
        const aiNotes = document.getElementById('aiNotes')?.value || '';
        
        const formData = {
            log_date: logDateHidden.value,
            log_protein: aiProtein,
            log_calories: aiCalories,
            log_carbs: aiCarbs,
            log_fat: aiFat,
            log_misc_info: aiNotes,
            meal_type: autoMealType.value,
            meal_name: autoMealType.value === 'custom' ? (autoCustomMealName?.value || '') : null
        };
        
        await apiCall('/weight', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        // Clear form and reset
        const foodDescription = document.getElementById('foodDescription');
        if (foodDescription) foodDescription.value = '';
        if (autoCustomMealName) autoCustomMealName.value = '';
        autoMealType.value = 'breakfast';
        
        const autoCustomMealGroup = document.getElementById('autoCustomMealGroup');
        if (autoCustomMealGroup) autoCustomMealGroup.style.display = 'none';
        
        // Hide AI results
        const aiResults = document.getElementById('ai-results');
        if (aiResults) aiResults.style.display = 'none';
        
        // Clear pending analysis
        pendingAIAnalysis = null;
        
        // Reload day data to show new meal
        await loadDayData(currentDate);
        
        // Reload data
        await loadData();
        
        alert('Entry saved successfully!');
        
    } catch (error) {
        console.error('Error saving data:', error);
        alert('Error saving data: ' + error.message);
    }
}

function editAIAnalysis() {
    // The user can directly edit the values in the form
    // This function could be used for additional editing features if needed
    const aiProtein = document.getElementById('aiProtein');
    if (aiProtein) aiProtein.focus();
}

function cancelAIAnalysis() {
    const aiResults = document.getElementById('ai-results');
    if (aiResults) aiResults.style.display = 'none';
    
    pendingAIAnalysis = null;
    
    // Clear the food description
    const foodDescription = document.getElementById('foodDescription');
    if (foodDescription) foodDescription.value = '';
}

// Helper function to update weight goals progress
async function updateWeightGoalsProgress(newWeight) {
    try {
        const goals = await apiCall('/goals');
        const weightGoals = goals.filter(g => 
            (g.goal_type === 'weight_loss' || g.goal_type === 'weight_gain' || g.goal_type === 'maintenance') 
            && g.status === 'active'
        );
        
        for (const goal of weightGoals) {
            await apiCall(`/goals/${goal.id}/progress`, {
                method: 'POST',
                body: JSON.stringify({
                    recorded_value: newWeight,
                    notes: `Weight logged via auto-tracking: ${newWeight}kg`
                })
            });
        }
    } catch (error) {
        console.error('Error updating weight goals:', error);
    }
}

// Calendar interface functionality
function initializeCalendarInterface() {
    const calendarDate = document.getElementById('calendar-date');
    const prevDayBtn = document.getElementById('prev-day');
    const nextDayBtn = document.getElementById('next-day');
    const todayBtn = document.getElementById('today-btn');
    
    // Set initial date to today
    if (calendarDate) {
        calendarDate.value = currentDate.toISOString().split('T')[0];
        
        // Add event listener for date changes
        calendarDate.addEventListener('change', (e) => {
            currentDate = new Date(e.target.value + 'T00:00:00');
            loadDayData(currentDate);
        });
    }
    
    // Previous day navigation
    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 1);
            calendarDate.value = currentDate.toISOString().split('T')[0];
            loadDayData(currentDate);
        });
    }
    
    // Next day navigation
    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 1);
            calendarDate.value = currentDate.toISOString().split('T')[0];
            loadDayData(currentDate);
        });
    }
    
    // Today button
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            currentDate = new Date();
            calendarDate.value = currentDate.toISOString().split('T')[0];
            loadDayData(currentDate);
        });
    }
    
    // Load initial day data
    loadDayData(currentDate);
    
    // Set up form dates to match selected date
    updateFormDates();
}

// Load data for a specific day
async function loadDayData(date) {
    const dateString = date.toISOString().split('T')[0];
    
    try {
        // Update selected date display
        const selectedDateDisplay = document.getElementById('selected-date-display');
        if (selectedDateDisplay) {
            selectedDateDisplay.textContent = date.toLocaleDateString();
        }
        
        // Load weight for the day
        await loadDayWeight(dateString);
        
        // Load meals for the day
        await loadDayMeals(dateString);
        
        // Load goals progress for the day
        await loadDayGoalsProgress(dateString);
        
        // Update form dates
        updateFormDates();
        
    } catch (error) {
        console.error('Error loading day data:', error);
    }
}

// Load weight data for a specific day
async function loadDayWeight(dateString) {
    try {
        const weightEntries = await apiCall('/weight-entries');
        const dayWeight = weightEntries.find(entry => entry.log_date === dateString);
        
        const weightDisplay = document.getElementById('current-weight-display');
        const weightInfo = document.getElementById('weight-display').querySelector('small');
        
        if (dayWeight) {
            weightDisplay.textContent = `${dayWeight.weight} kg`;
            weightDisplay.className = 'h3 text-success mb-0';
            weightInfo.textContent = dayWeight.notes || 'Weight logged';
            weightInfo.className = 'text-muted';
        } else {
            weightDisplay.textContent = '--';
            weightDisplay.className = 'h3 text-muted mb-0';
            weightInfo.textContent = 'No weight logged';
            weightInfo.className = 'text-muted';
        }
    } catch (error) {
        console.error('Error loading day weight:', error);
    }
}

// Load meals data for a specific day
async function loadDayMeals(dateString) {
    try {
        const dayData = await apiCall(`/weight/day/${dateString}`);
        
        // Calculate daily totals
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        
        dayData.forEach(entry => {
            totalCalories += entry.log_calories || 0;
            totalProtein += entry.log_protein || 0;
            totalCarbs += entry.log_carbs || 0;
            totalFat += entry.log_fat || 0;
        });
        
        // Update totals display
        document.getElementById('daily-total-calories').textContent = totalCalories.toFixed(0);
        document.getElementById('daily-total-protein').textContent = `${totalProtein.toFixed(1)}g`;
        document.getElementById('daily-total-carbs').textContent = `${totalCarbs.toFixed(1)}g`;
        document.getElementById('daily-total-fat').textContent = `${totalFat.toFixed(1)}g`;
        
        // Update meals list
        const mealsList = document.getElementById('daily-meals-list');
        if (dayData.length === 0) {
            mealsList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-utensils fa-2x mb-2"></i>
                    <div>No meals logged for this date</div>
                </div>
            `;
        } else {
            const mealsHTML = dayData.map(entry => {
                let mealDisplay = '';
                if (entry.meal_type === 'custom' && entry.meal_name) {
                    mealDisplay = entry.meal_name;
                } else {
                    const mealTypes = {
                        'breakfast': 'Breakfast',
                        'lunch': 'Lunch',
                        'dinner': 'Dinner',
                        'morning_snack': 'Morning Snack',
                        'evening_snack': 'Evening Snack',
                        'full_day': 'Full Day'
                    };
                    mealDisplay = mealTypes[entry.meal_type] || entry.meal_type;
                }
                
                return `
                    <div class="meal-entry p-3 mb-2 border rounded">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="mb-1">${mealDisplay}</h6>
                                <div class="row g-2">
                                    <div class="col-3">
                                        <small class="text-muted">Calories</small>
                                        <div class="fw-bold text-success">${entry.log_calories}</div>
                                    </div>
                                    <div class="col-3">
                                        <small class="text-muted">Protein</small>
                                        <div class="fw-bold text-info">${entry.log_protein}g</div>
                                    </div>
                                    <div class="col-3">
                                        <small class="text-muted">Carbs</small>
                                        <div class="fw-bold text-warning">${entry.log_carbs}g</div>
                                    </div>
                                    <div class="col-3">
                                        <small class="text-muted">Fat</small>
                                        <div class="fw-bold text-danger">${entry.log_fat}g</div>
                                    </div>
                                </div>
                                ${entry.log_misc_info ? `<small class="text-muted d-block mt-2">${entry.log_misc_info}</small>` : ''}
                            </div>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary" onclick="editEntry('${entry.id}')" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-outline-danger" onclick="deleteEntry('${entry.id}')" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            mealsList.innerHTML = mealsHTML;
        }
    } catch (error) {
        console.error('Error loading day meals:', error);
    }
}

// Load goals progress for a specific day
async function loadDayGoalsProgress(dateString) {
    try {
        const goals = await apiCall('/goals');
        const activeGoals = goals.filter(g => g.status === 'active' && (g.goal_type === 'calorie' || g.goal_type === 'protein'));
        
        if (activeGoals.length === 0) {
            document.getElementById('goals-progress-card').style.display = 'none';
            return;
        }
        
        // Get day's nutrition data
        const dayData = await apiCall(`/weight/day/${dateString}`);
        let totalCalories = 0;
        let totalProtein = 0;
        
        dayData.forEach(entry => {
            totalCalories += entry.log_calories || 0;
            totalProtein += entry.log_protein || 0;
        });
        
        // Generate goals progress HTML
        let progressHTML = '';
        
        activeGoals.forEach(goal => {
            if (goal.goal_type === 'calorie') {
                const progress = (totalCalories / goal.daily_limit) * 100;
                const remaining = goal.daily_limit - totalCalories;
                const status = remaining >= 0 ? 'success' : 'danger';
                const statusText = remaining >= 0 ? `${remaining.toFixed(0)} calories remaining` : `${Math.abs(remaining).toFixed(0)} calories over limit`;
                
                progressHTML += `
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="mb-0">${goal.title}</h6>
                            <span class="badge bg-${status}">${statusText}</span>
                        </div>
                        <div class="progress" style="height: 12px;">
                            <div class="progress-bar bg-${status}" style="width: ${Math.min(progress, 100)}%" 
                                 title="${totalCalories} / ${goal.daily_limit} calories"></div>
                        </div>
                        <small class="text-muted">${totalCalories} / ${goal.daily_limit} calories (${progress.toFixed(1)}%)</small>
                    </div>
                `;
            } else if (goal.goal_type === 'protein') {
                const progress = (totalProtein / goal.daily_limit) * 100;
                const remaining = goal.daily_limit - totalProtein;
                const status = remaining >= 0 ? 'success' : 'danger';
                const statusText = remaining >= 0 ? `${remaining.toFixed(1)}g remaining` : `${Math.abs(remaining).toFixed(1)}g over limit`;
                
                progressHTML += `
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="mb-0">${goal.title}</h6>
                            <span class="badge bg-${status}">${statusText}</span>
                        </div>
                        <div class="progress" style="height: 12px;">
                            <div class="progress-bar bg-${status}" style="width: ${Math.min(progress, 100)}%" 
                                 title="${totalProtein.toFixed(1)} / ${goal.daily_limit}g protein"></div>
                        </div>
                        <small class="text-muted">${totalProtein.toFixed(1)} / ${goal.daily_limit}g protein (${progress.toFixed(1)}%)</small>
                    </div>
                `;
            }
        });
        
        if (progressHTML) {
            document.getElementById('daily-goals-progress').innerHTML = progressHTML;
            document.getElementById('goals-progress-card').style.display = 'block';
        } else {
            document.getElementById('goals-progress-card').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error loading day goals progress:', error);
        document.getElementById('goals-progress-card').style.display = 'none';
    }
}

// Update form dates to match selected date
function updateFormDates() {
    const dateString = currentDate.toISOString().split('T')[0];
    
    // Update weight form
    const weightDateHidden = document.getElementById('weightDateHidden');
    if (weightDateHidden) {
        weightDateHidden.value = dateString;
    }
    
    // Update nutrition form
    const logDateHidden = document.getElementById('logDateHidden');
    if (logDateHidden) {
        logDateHidden.value = dateString;
    }
}