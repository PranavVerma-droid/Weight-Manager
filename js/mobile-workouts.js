// Mobile workout functionality
let selectedWorkouts = new Set();

function createWorkoutCard(workout) {
    const card = document.createElement('div');
    card.className = 'workout-card';
    card.dataset.workoutId = workout.id;
    
    const isSelected = selectedWorkouts.has(workout.id);
    if (isSelected) {
        card.classList.add('selected');
    }
    
    card.innerHTML = `
        <div class="workout-card-header">
            <div class="workout-date">${new Date(workout.date).toLocaleDateString()}</div>
            <div class="form-check">
                <input class="form-check-input workout-checkbox" type="checkbox" value="${workout.id}" ${isSelected ? 'checked' : ''}>
            </div>
        </div>
        <div class="workout-title">${workout.title}</div>
        <div class="workout-details">
            <div class="workout-detail">
                <div class="workout-detail-value">${workout.duration}</div>
                <div class="workout-detail-label">Duration</div>
            </div>
            <div class="workout-detail">
                <div class="workout-detail-value">${workout.exercises}</div>
                <div class="workout-detail-label">Exercises</div>
            </div>
            <div class="workout-detail">
                <div class="workout-detail-value">${workout.total_sets}</div>
                <div class="workout-detail-label">Total Sets</div>
            </div>
            <div class="workout-detail">
                <div class="workout-detail-value">${workout.total_volume || 'N/A'}</div>
                <div class="workout-detail-label">Volume</div>
            </div>
        </div>
        <div class="workout-actions">
            <button class="btn btn-sm btn-outline-danger delete-workout" data-id="${workout.id}">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    // Add click handler for card selection
    card.addEventListener('click', (e) => {
        if (e.target.type !== 'checkbox' && !e.target.closest('button')) {
            const checkbox = card.querySelector('.workout-checkbox');
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    });
    
    return card;
}

function renderMobileWorkoutCards(workouts) {
    const container = document.getElementById('workout-cards-body');
    if (!container) return;
    
    container.innerHTML = '';
    
    workouts.forEach(workout => {
        const card = createWorkoutCard(workout);
        container.appendChild(card);
    });
    
    // Add event listeners for checkboxes
    container.addEventListener('change', (e) => {
        if (e.target.classList.contains('workout-checkbox')) {
            const workoutId = e.target.value;
            const card = e.target.closest('.workout-card');
            
            if (e.target.checked) {
                selectedWorkouts.add(workoutId);
                card.classList.add('selected');
            } else {
                selectedWorkouts.delete(workoutId);
                card.classList.remove('selected');
            }
            
            updateDeleteButtonState();
            updateSelectAllState();
        }
    });
    
    // Add event listeners for delete buttons
    container.addEventListener('click', (e) => {
        if (e.target.closest('.delete-workout')) {
            const workoutId = e.target.closest('.delete-workout').dataset.id;
            if (confirm('Are you sure you want to delete this workout?')) {
                deleteWorkout(workoutId);
            }
        }
    });
}

function updateSelectAllState() {
    const allCheckboxes = document.querySelectorAll('.workout-checkbox');
    const selectAllDesktop = document.getElementById('select-all-workouts');
    const selectAllMobile = document.getElementById('select-all-workouts-mobile');
    
    const checkedCount = document.querySelectorAll('.workout-checkbox:checked').length;
    const totalCount = allCheckboxes.length;
    
    if (selectAllDesktop) {
        selectAllDesktop.checked = checkedCount === totalCount && totalCount > 0;
        selectAllDesktop.indeterminate = checkedCount > 0 && checkedCount < totalCount;
    }
    
    if (selectAllMobile) {
        selectAllMobile.checked = checkedCount === totalCount && totalCount > 0;
        selectAllMobile.indeterminate = checkedCount > 0 && checkedCount < totalCount;
    }
}

function updateDeleteButtonState() {
    const hasSelected = selectedWorkouts.size > 0;
    const deleteBtn = document.getElementById('delete-selected-workouts');
    const deleteBtnMobile = document.getElementById('delete-selected-workouts-mobile');
    
    if (deleteBtn) {
        deleteBtn.disabled = !hasSelected;
    }
    if (deleteBtnMobile) {
        deleteBtnMobile.disabled = !hasSelected;
    }
}

// Initialize mobile controls
function initMobileControls() {
    // Mobile import button
    const importBtnMobile = document.getElementById('import-workout-btn-mobile');
    const fileInput = document.getElementById('workout-file-input');
    
    if (importBtnMobile && fileInput) {
        importBtnMobile.addEventListener('click', () => {
            fileInput.click();
        });
    }
    
    // Mobile delete button
    const deleteBtnMobile = document.getElementById('delete-selected-workouts-mobile');
    if (deleteBtnMobile) {
        deleteBtnMobile.addEventListener('click', () => {
            if (selectedWorkouts.size > 0) {
                const count = selectedWorkouts.size;
                if (confirm(`Are you sure you want to delete ${count} workout${count > 1 ? 's' : ''}?`)) {
                    deleteSelectedWorkouts();
                }
            }
        });
    }
    
    // Mobile select all
    const selectAllMobile = document.getElementById('select-all-workouts-mobile');
    if (selectAllMobile) {
        selectAllMobile.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.workout-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                const workoutId = checkbox.value;
                const card = checkbox.closest('.workout-card');
                
                if (e.target.checked) {
                    selectedWorkouts.add(workoutId);
                    if (card) card.classList.add('selected');
                } else {
                    selectedWorkouts.delete(workoutId);
                    if (card) card.classList.remove('selected');
                }
            });
            
            updateDeleteButtonState();
        });
    }
}

// Add CSS for selected workout cards
const mobileStyles = `
    .workout-card.selected {
        border-color: var(--primary-color) !important;
        background: rgba(99, 102, 241, 0.05) !important;
        transform: translateY(-1px);
        box-shadow: 0 8px 25px rgba(99, 102, 241, 0.15) !important;
    }
    
    .workout-card.selected::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: var(--primary-color);
        border-radius: 0 4px 4px 0;
    }
    
    .workout-card {
        position: relative;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s ease;
    }
    
    .workout-card:active {
        transform: scale(0.98);
    }
    
    .workout-checkbox {
        pointer-events: none;
    }
`;

// Inject mobile styles
const styleSheet = document.createElement('style');
styleSheet.textContent = mobileStyles;
document.head.appendChild(styleSheet);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initMobileControls);

// Export functions for use in main app
window.mobileWorkouts = {
    renderMobileWorkoutCards,
    updateSelectAllState,
    updateDeleteButtonState,
    selectedWorkouts
};