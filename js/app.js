// Initialize PocketBase client
const pb = new PocketBase("https://pb-1.pranavv.co.in");

// Initialize charts 
let weightChart;
let nutritionChart;

// DOM elements
const weightForm = document.getElementById('weight-form');
const dataTableBody = document.getElementById('data-table-body');
const userInfoElement = document.getElementById('user-info');
const logoutBtn = document.getElementById('logout-btn');
const exportDataBtn = document.getElementById('export-data-btn');
const importDataBtn = document.getElementById('import-data-btn');
const importFileInput = document.getElementById('import-file-input');

// Load data when page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is authenticated
    if (!pb.authStore.isValid) {
        // Redirect to login page if not authenticated
        window.location.href = 'login.html';
        return;
    }
    
    // Display user info
    if (userInfoElement) {
        userInfoElement.textContent = pb.authStore.model.email;
    }
    
    // Set default date to current date (no time)
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    document.getElementById('logDate').value = dateString;
    
    await loadData();
});

// Logout handler
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        pb.authStore.clear();
        window.location.href = 'login.html';
    });
}

// Export data handler
if (exportDataBtn) {
    exportDataBtn.addEventListener('click', async () => {
        try {
            // Get all records
            const records = await pb.collection('weight').getList(1, 1000, {
                sort: 'logDate'
            });
            
            if (records.items.length === 0) {
                alert('No data to export');
                return;
            }
            
            // Convert to JSON
            const dataStr = JSON.stringify(records.items, null, 2);
            
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
            
            if (!Array.isArray(data)) {
                alert('Invalid file format. Expected an array of records.');
                return;
            }
            
            if (data.length === 0) {
                alert('No data found in the file');
                return;
            }
            
            // Confirm import
            const confirmed = confirm(`Are you sure you want to import ${data.length} records? This will add new entries to your existing data.`);
            if (!confirmed) return;
            
            let successCount = 0;
            let errorCount = 0;
            
            // Import each record
            for (const record of data) {
                try {
                    // Extract only the fields we need, excluding PocketBase metadata
                    const importData = {
                        logDate: record.logDate,
                        logWeight: record.logWeight || 0,
                        logProtein: record.logProtein || 0,
                        logCalories: record.logCalories || 0,
                        logCarbs: record.logCarbs || 0,
                        logFat: record.logFat || 0,
                        logMiscInfo: record.logMiscInfo || ""
                    };
                    
                    // Check if a record with this date already exists
                    try {
                        const existingRecords = await pb.collection('weight').getList(1, 1, {
                            filter: `logDate = "${record.logDate}"`
                        });
                        
                        if (existingRecords.items.length > 0) {
                            // Update existing record
                            await pb.collection('weight').update(existingRecords.items[0].id, importData);
                        } else {
                            // Create new record
                            await pb.collection('weight').create(importData);
                        }
                        successCount++;
                    } catch (recordError) {
                        console.error('Error importing record:', recordError);
                        errorCount++;
                    }
                } catch (recordError) {
                    console.error('Error processing record:', recordError);
                    errorCount++;
                }
            }
            
            // Show results
            let message = `Import completed!\nSuccessfully imported: ${successCount} records`;
            if (errorCount > 0) {
                message += `\nFailed: ${errorCount} records`;
            }
            alert(message);
            
            // Reload data
            await loadData();
            
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
            logDate: document.getElementById('logDate').value,
            logWeight: parseFloat(document.getElementById('logWeight').value) || 0,
            logProtein: parseFloat(document.getElementById('logProtein').value) || 0,
            logCalories: parseFloat(document.getElementById('logCalories').value) || 0,
            logCarbs: parseFloat(document.getElementById('logCarbs').value) || 0,
            logFat: parseFloat(document.getElementById('logFat').value) || 0,
            logMiscInfo: document.getElementById('logMiscInfo').value || ""
        };

        await pb.collection('weight').create(formData);
        
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

// Load data from PocketBase
async function loadData() {
    try {
        // Get all records for now (we'll filter by user later if needed)
        const records = await pb.collection('weight').getList(1, 100, {
            sort: 'logDate'
        });
        
        displayTableData(records.items);
        renderWeightChart(records.items);
        renderNutritionChart(records.items);
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
        const date = new Date(item.logDate);
        const formattedDate = date.toLocaleDateString();
        
        // Create a unique ID for the collapse element
        const collapseId = `note-collapse-${index}`;
        
        // Check if there are notes to show the collapse button
        const hasNotes = item.logMiscInfo && item.logMiscInfo.trim() !== '';
        const notesButton = hasNotes ? 
            `<button class="btn btn-sm btn-outline-primary" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                Show Notes
            </button>` : 
            '<span class="text-muted">No notes</span>';
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${item.logWeight}</td>
            <td>${item.logProtein}</td>
            <td>${item.logCalories}</td>
            <td>${item.logCarbs}</td>
            <td>${item.logFat}</td>
            <td>
                ${notesButton}
                <div class="collapse mt-2" id="${collapseId}">
                    <div class="card card-body">
                        ${item.logMiscInfo || ''}
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
        const record = await pb.collection('weight').getOne(id);
        
        // Populate the form fields with the record data
        document.getElementById('editId').value = record.id;
        
        // Format date for input (YYYY-MM-DD)
        const date = new Date(record.logDate);
        document.getElementById('editDate').value = date.toISOString().split('T')[0];
        
        document.getElementById('editWeight').value = record.logWeight;
        document.getElementById('editProtein').value = record.logProtein;
        document.getElementById('editCalories').value = record.logCalories;
        document.getElementById('editCarbs').value = record.logCarbs;
        document.getElementById('editFat').value = record.logFat;
        document.getElementById('editMiscInfo').value = record.logMiscInfo;
        
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
            logDate: document.getElementById('editDate').value,
            logWeight: parseFloat(document.getElementById('editWeight').value) || 0,
            logProtein: parseFloat(document.getElementById('editProtein').value) || 0,
            logCalories: parseFloat(document.getElementById('editCalories').value) || 0,
            logCarbs: parseFloat(document.getElementById('editCarbs').value) || 0,
            logFat: parseFloat(document.getElementById('editFat').value) || 0,
            logMiscInfo: document.getElementById('editMiscInfo').value || ""
        };
        
        await pb.collection('weight').update(id, formData);
        
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
            await pb.collection('weight').delete(id);
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
    
    // Format data for chart
    const dates = items.map(item => {
        const date = new Date(item.logDate);
        return date.toLocaleDateString();
    });
    
    const weights = items.map(item => item.logWeight);
    
    // Destroy existing chart if it exists
    if (weightChart) {
        weightChart.destroy();
    }
    
    // Create new chart
    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Weight (kg)',
                data: weights,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false
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
        const date = new Date(item.logDate);
        return date.toLocaleDateString();
    });
    
    const proteins = recentItems.map(item => item.logProtein);
    const calories = recentItems.map(item => item.logCalories / 100); // Scale down calories to fit with other metrics
    const carbs = recentItems.map(item => item.logCarbs);
    const fats = recentItems.map(item => item.logFat);
    
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