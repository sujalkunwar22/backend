// API Configuration
const API_BASE_URL = '/api';
let authToken = localStorage.getItem('adminToken');
let currentUser = null;

// Utility Functions
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => {
        element.classList.remove('show');
    }, 5000);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const pageElement = document.getElementById(pageId);
    if (pageElement) {
        pageElement.classList.add('active');
    } else {
        console.error(`Page element not found: ${pageId}`);
        return;
    }
    
    // Map page IDs back to data-page attributes
    const pageToDataPageMap = {
        'dashboardPage': 'dashboard',
        'verificationRequestsPage': 'verification-requests',
        'lawyersPage': 'lawyers',
        'usersPage': 'users',
        'statsPage': 'stats'
    };
    
    const dataPage = pageToDataPageMap[pageId] || pageId.replace('Page', '').toLowerCase();
    const navLink = document.querySelector(`[data-page="${dataPage}"]`);
    if (navLink) {
        navLink.classList.add('active');
    } else {
        console.error(`Nav link not found for page: ${dataPage}`);
    }
}

// API Functions
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
        ...options,
    };

    if (options.body) {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                logout();
                throw new Error('Session expired. Please login again.');
            }
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Authentication
async function login(email, password) {
    try {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: { email, password },
        });

        if (response.success && response.data.user.role === 'ADMIN') {
            authToken = response.data.token;
            currentUser = response.data.user;
            localStorage.setItem('adminToken', authToken);
            showScreen('dashboardScreen');
            loadDashboard();
            return true;
        } else {
            throw new Error('Access denied. Admin role required.');
        }
    } catch (error) {
        throw error;
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('adminToken');
    showScreen('loginScreen');
}

// Dashboard Functions
async function loadDashboard() {
    try {
        const stats = await apiRequest('/admin/stats');
        document.getElementById('totalUsers').textContent = (stats.data.totalUsers || 0) - (stats.data.totalAdmins || 0);
        document.getElementById('totalLawyers').textContent = stats.data.totalLawyers || 0;
        document.getElementById('totalClients').textContent = stats.data.totalClients || 0;
        document.getElementById('pendingVerifications').textContent = stats.data.pendingVerifications || 0;
        document.getElementById('adminName').textContent = currentUser?.firstName || 'Admin';
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Lawyers Functions
async function loadLawyers() {
    const listContainer = document.getElementById('lawyersList');
    listContainer.innerHTML = '<div class="loading">Loading lawyers...</div>';

    try {
        const response = await apiRequest('/lawyers');
        const lawyers = response.data.lawyers || [];
        const showOnlyUnverified = document.getElementById('showOnlyUnverified').checked;
        
        const filteredLawyers = showOnlyUnverified
            ? lawyers.filter(l => !l.isVerified)
            : lawyers;

        if (filteredLawyers.length === 0) {
            listContainer.innerHTML = '<div class="empty-state"><h3>No lawyers found</h3><p>All lawyers are verified or no lawyers exist yet.</p></div>';
            return;
        }

        listContainer.innerHTML = filteredLawyers.map(lawyer => {
            const user = lawyer.user || {};
            const userId = user._id || user.id || '';
            const firstName = user.firstName || '';
            const lastName = user.lastName || '';
            const email = user.email || '';
            const phone = user.phone || 'Not provided';
            const isVerified = lawyer.isVerified || false;
            const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
            const profileCreatedAt = lawyer.createdAt ? new Date(lawyer.createdAt).toLocaleDateString() : 'N/A';
            const profileUpdatedAt = lawyer.updatedAt ? new Date(lawyer.updatedAt).toLocaleDateString() : 'N/A';
            
            return `
            <div class="card" style="border-left: 4px solid ${isVerified ? 'var(--success-color)' : 'var(--warning-color)'};">
                <div class="card-header">
                    <div>
                        <div class="card-title">
                            ${firstName} ${lastName}
                            ${isVerified ? '<span style="margin-left: 0.5rem; color: var(--success-color); font-size: 1rem;">✓</span>' : ''}
                        </div>
                        <div class="card-subtitle">${email}</div>
                        <div style="margin-top: 0.25rem; font-size: 0.75rem; color: var(--text-secondary);">
                            User ID: <span style="font-family: monospace;">${userId}</span>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        ${isVerified 
                            ? '<span class="badge badge-success">✓ VERIFIED LAWYER</span>' 
                            : '<span class="badge badge-warning">⏳ PENDING VERIFICATION</span>'}
                        <span style="font-size: 0.75rem; color: var(--text-secondary);">
                            ${isVerified ? 'Verified on: ' + profileUpdatedAt : 'Awaiting verification'}
                        </span>
                    </div>
                </div>
                <div class="card-body">
                    <div style="margin-bottom: 1rem; padding: 1rem; background: ${isVerified ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; border-radius: 8px; border-left: 3px solid ${isVerified ? 'var(--success-color)' : 'var(--warning-color)'};">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <strong style="color: ${isVerified ? 'var(--success-color)' : 'var(--warning-color)'}; font-size: 1rem;">
                                ${isVerified ? '✓ VERIFIED LAWYER' : '⏳ VERIFICATION PENDING'}
                            </strong>
                        </div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">
                            <div style="margin-bottom: 0.5rem;">
                                <strong>Account:</strong> ${firstName} ${lastName} (${email}) - User ID: <span style="font-family: monospace; font-size: 0.75rem;">${userId}</span>
                            </div>
                            ${isVerified 
                                ? `<div><strong>Status:</strong> This lawyer account has been verified and is active on the platform. Verification completed on ${profileUpdatedAt}. The personal account (${email}) is linked to this verified professional profile.</div>`
                                : `<div><strong>Status:</strong> The personal account for ${firstName} ${lastName} (${email}) is pending verification. Review their personal information and professional credentials below before verifying this lawyer account.</div>`}
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
                        <h4 style="margin-bottom: 0.75rem; color: var(--primary-color); display: flex; align-items: center; gap: 0.5rem;">
                            <span>👤</span> Personal Information & Account Details
                        </h4>
                        <div class="card-info">
                            <div class="info-item">
                                <span class="info-label">User ID</span>
                                <span class="info-value" style="font-size: 0.75rem; word-break: break-all;">${userId}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Full Name</span>
                                <span class="info-value">${firstName} ${lastName}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Email</span>
                                <span class="info-value">${email}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Phone</span>
                                <span class="info-value">${phone}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Account Created</span>
                                <span class="info-value">${createdAt}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Account Status</span>
                                <span class="info-value" style="color: var(--success-color);">✓ Active</span>
                            </div>
                            ${user.profilePicture ? `
                            <div class="info-item">
                                <span class="info-label">Profile Picture</span>
                                <span class="info-value">
                                    <a href="${user.profilePicture}" target="_blank" style="color: var(--primary-color); text-decoration: underline;">View Profile Image</a>
                                </span>
                            </div>
                            ` : ''}
                        </div>
                        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(37, 99, 235, 0.05); border-radius: 6px; border-left: 3px solid var(--primary-color);">
                            <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                <strong style="color: var(--primary-color);">Account Summary:</strong> ${firstName} ${lastName} (${email}) registered on ${createdAt}. 
                                ${isVerified ? 'Profile verified and active.' : 'Profile pending verification.'}
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
                        <h4 style="margin-bottom: 0.75rem; color: var(--primary-color); display: flex; align-items: center; gap: 0.5rem;">
                            <span>⚖️</span> Professional Information & Credentials
                        </h4>
                        <div class="card-info">
                            <div class="info-item">
                                <span class="info-label">Bar License Number</span>
                                <span class="info-value">${lawyer.barLicenseNumber || 'Not provided'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Specializations</span>
                                <span class="info-value">${(lawyer.specialization || []).length > 0 ? (lawyer.specialization || []).join(', ') : 'Not specified'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Years of Experience</span>
                                <span class="info-value">${lawyer.experience || 0} years</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Hourly Rate</span>
                                <span class="info-value" style="color: var(--success-color); font-weight: bold;">Rs. ${lawyer.hourlyRate || 0}/hr</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Rating</span>
                                <span class="info-value">${lawyer.rating ? lawyer.rating.toFixed(1) : '0.0'} ⭐ (${lawyer.totalReviews || 0} reviews)</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Verification Status</span>
                                <span class="info-value" style="color: ${isVerified ? 'var(--success-color)' : 'var(--warning-color)'}; font-weight: bold;">
                                    ${isVerified ? '✓ VERIFIED' : '⏳ PENDING VERIFICATION'}
                                </span>
                            </div>
                            ${isVerified ? `
                            <div class="info-item">
                                <span class="info-label">Verified On</span>
                                <span class="info-value">${profileUpdatedAt}</span>
                            </div>
                            ` : ''}
                            <div class="info-item">
                                <span class="info-label">Profile Created</span>
                                <span class="info-value">${profileCreatedAt}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Last Profile Update</span>
                                <span class="info-value">${profileUpdatedAt}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${lawyer.bio ? `
                    <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
                        <h4 style="margin-bottom: 0.75rem; color: var(--text-primary);">Bio</h4>
                        <p style="color: var(--text-secondary); line-height: 1.6;">${lawyer.bio}</p>
                    </div>
                    ` : ''}
                    
                    ${lawyer.education && lawyer.education.length > 0 ? `
                    <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
                        <h4 style="margin-bottom: 0.75rem; color: var(--text-primary);">Education</h4>
                        ${lawyer.education.map(edu => `
                            <div style="margin-bottom: 0.5rem;">
                                <strong>${edu.degree || 'N/A'}</strong> - ${edu.institution || 'N/A'} (${edu.year || 'N/A'})
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                    
                    ${lawyer.languages && lawyer.languages.length > 0 ? `
                    <div style="margin-bottom: 1rem;">
                        <h4 style="margin-bottom: 0.75rem; color: var(--text-primary);">Languages</h4>
                        <span class="info-value">${lawyer.languages.join(', ')}</span>
                    </div>
                    ` : ''}
                    
                    ${!isVerified ? `
                        <div class="card-actions" style="margin-top: 1.5rem; padding: 1rem; background: rgba(245, 158, 11, 0.05); border: 2px dashed var(--warning-color); border-radius: 8px;">
                            <div style="margin-bottom: 0.75rem;">
                                <strong style="color: var(--warning-color); display: block; margin-bottom: 0.25rem;">Verification Action Required</strong>
                                <div style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">
                                    <div style="margin-bottom: 0.5rem;">
                                        <strong>Account to Verify:</strong> ${firstName} ${lastName} (${email})
                                    </div>
                                    <div>
                                        Review the personal information (account details, contact info) and professional credentials (license, experience, specializations) above. 
                                        Set an hourly rate and click verify to approve this lawyer account. Verification will link the personal account (${email}) to the verified professional profile.
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                                <div>
                                    <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: var(--text-primary); font-weight: 500;">
                                        Set Hourly Rate (Rs.) *
                                    </label>
                                    <input type="number" 
                                           id="hourlyRate_${userId}" 
                                           placeholder="Enter hourly rate" 
                                           value="${lawyer.hourlyRate || ''}" 
                                           min="0"
                                           step="0.01"
                                           required
                                           style="width: 200px; padding: 0.5rem; border: 2px solid var(--warning-color); border-radius: 6px; font-size: 1rem;">
                                </div>
                                <div style="display: flex; align-items: flex-end;">
                                    <button class="btn btn-success verify-lawyer-btn" data-lawyer-id="${userId}" style="padding: 0.75rem 1.5rem; font-weight: 600;">
                                        ✓ Verify & Approve Lawyer
                                    </button>
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color); font-size: 0.75rem; color: var(--text-secondary);">
                                <strong>Verifying will:</strong> Approve the lawyer's profile, allow them to set/edit hourly rates, and make them visible to clients on the platform.
                            </div>
                        </div>
                    ` : `
                        <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(16, 185, 129, 0.1); border: 2px solid var(--success-color); border-radius: 8px;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="font-size: 1.5rem;">✓</span>
                                <strong style="color: var(--success-color);">Verified Lawyer</strong>
                            </div>
                            <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                This lawyer has been verified and is active on the platform. They can set/edit their hourly rates and are visible to clients.
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(16, 185, 129, 0.3);">
                                <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                                    <strong style="color: var(--success-color);">✓ Verification Linked to Personal Account:</strong>
                                </div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem;">
                                    <div><strong>Account:</strong> ${firstName} ${lastName}</div>
                                    <div><strong>Email:</strong> ${email}</div>
                                    <div><strong>User ID:</strong> <span style="font-family: monospace;">${userId}</span></div>
                                    <div><strong>Verified on:</strong> ${profileUpdatedAt}</div>
                                    <div><strong>Account created:</strong> ${createdAt}</div>
                                </div>
                            </div>
                        </div>
                    `}
                </div>
            </div>
        `;
        }).join('');
    } catch (error) {
        listContainer.innerHTML = `<div class="error-message show">Error loading lawyers: ${error.message}</div>`;
    }
}

async function verifyLawyer(lawyerId) {
    const hourlyRateInput = document.getElementById(`hourlyRate_${lawyerId}`);
    const hourlyRate = hourlyRateInput ? parseFloat(hourlyRateInput.value) : null;

    if (hourlyRateInput && (!hourlyRate || hourlyRate < 0)) {
        alert('Please enter a valid hourly rate');
        return;
    }

    if (!confirm('Are you sure you want to verify this lawyer?')) {
        return;
    }

    try {
        await apiRequest(`/admin/lawyers/${lawyerId}/verify`, {
            method: 'PATCH',
            body: hourlyRate ? { hourlyRate } : {},
        });
        alert('Lawyer verified successfully!');
        loadLawyers();
        loadDashboard();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Users Functions
async function loadUsers() {
    const listContainer = document.getElementById('usersList');
    listContainer.innerHTML = '<div class="loading">Loading users...</div>';

    try {
        const roleFilter = document.getElementById('userRoleFilter').value;
        const response = await apiRequest(`/admin/users${roleFilter ? `?role=${roleFilter}` : ''}`);
        const users = response.data.users || [];
        
        // Filter out admins (don't show other admins)
        const filteredUsers = users.filter(user => user.role !== 'ADMIN');

        if (filteredUsers.length === 0) {
            listContainer.innerHTML = '<div class="empty-state"><h3>No users found</h3><p>No users match your filter criteria.</p></div>';
            return;
        }

        listContainer.innerHTML = filteredUsers.map(user => {
            const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
            const updatedAt = user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'N/A';
            
            return `
            <div class="card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${user.firstName} ${user.lastName}</div>
                        <div class="card-subtitle">${user.email}</div>
                    </div>
                    <div>
                        <span class="badge ${user.isActive ? 'badge-success' : 'badge-danger'}">
                            ${user.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span class="badge ${user.role === 'LAWYER' ? 'badge-success' : user.role === 'CLIENT' ? 'badge-warning' : ''}" style="margin-left: 0.5rem;">
                            ${user.role}
                        </span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-info">
                        <div class="info-item">
                            <span class="info-label">User ID</span>
                            <span class="info-value" style="font-size: 0.75rem; word-break: break-all;">${user._id || user.id}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Full Name</span>
                            <span class="info-value">${user.firstName} ${user.lastName}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Email</span>
                            <span class="info-value">${user.email}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Phone</span>
                            <span class="info-value">${user.phone || 'Not provided'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Role</span>
                            <span class="info-value">${user.role}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Status</span>
                            <span class="info-value">${user.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Account Created</span>
                            <span class="info-value">${createdAt}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Last Updated</span>
                            <span class="info-value">${updatedAt}</span>
                        </div>
                        ${user.profilePicture ? `
                        <div class="info-item">
                            <span class="info-label">Profile Picture</span>
                            <span class="info-value">
                                <a href="${user.profilePicture}" target="_blank" style="color: var(--primary-color);">View Image</a>
                            </span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-secondary btn-small edit-user-btn" data-user-id="${user._id || user.id}">
                            Edit Details
                        </button>
                        <button class="btn btn-secondary btn-small change-password-btn" data-user-id="${user._id || user.id}">
                            Change Password
                        </button>
                        <button class="btn ${user.isActive ? 'btn-danger' : 'btn-success'} btn-small toggle-user-status-btn" 
                                data-user-id="${user._id || user.id}" 
                                data-is-active="${user.isActive}">
                            ${user.isActive ? 'Deactivate Account' : 'Activate Account'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    } catch (error) {
        listContainer.innerHTML = `<div class="error-message show">Error loading users: ${error.message}</div>`;
    }
}

// Event delegation for toggle user status buttons
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('toggle-user-status-btn')) {
        const userId = e.target.getAttribute('data-user-id');
        const isActive = e.target.getAttribute('data-is-active') === 'true';
        const activate = !isActive;

        if (!confirm(`Are you sure you want to ${activate ? 'activate' : 'deactivate'} this user?`)) {
            return;
        }

        try {
            await apiRequest(`/admin/users/${userId}/status`, {
                method: 'PATCH',
                body: { isActive: activate },
            });
            alert(`User ${activate ? 'activated' : 'deactivated'} successfully!`);
            loadUsers();
            loadDashboard();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }
});

async function toggleUserStatus(userId, activate) {
    if (!confirm(`Are you sure you want to ${activate ? 'activate' : 'deactivate'} this user?`)) {
        return;
    }

    try {
        await apiRequest(`/admin/users/${userId}/status`, {
            method: 'PATCH',
            body: { isActive: activate },
        });
        alert(`User ${activate ? 'activated' : 'deactivated'} successfully!`);
        loadUsers();
        loadDashboard();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Verification Requests Functions
async function loadVerificationRequests() {
    const listContainer = document.getElementById('verificationRequestsList');
    listContainer.innerHTML = '<div class="loading">Loading verification requests...</div>';

    try {
        const statusFilter = document.getElementById('requestStatusFilter').value;
        const response = await apiRequest(`/admin/verification/requests${statusFilter ? `?status=${statusFilter}` : ''}`);
        const requests = response.data.requests || [];

        if (requests.length === 0) {
            listContainer.innerHTML = '<div class="empty-state"><h3>No verification requests found</h3><p>All requests have been processed or no requests exist yet.</p></div>';
            return;
        }

        listContainer.innerHTML = requests.map(request => {
            const lawyer = request.lawyer || {};
            const profile = request.lawyerProfile || {};
            const reviewedBy = request.reviewedBy || {};
            const lawyerId = lawyer._id || lawyer.id || '';
            const firstName = lawyer.firstName || '';
            const lastName = lawyer.lastName || '';
            const email = lawyer.email || '';
            const phone = lawyer.phone || 'Not provided';
            const submittedAt = request.submittedAt ? new Date(request.submittedAt).toLocaleString() : 'N/A';
            const reviewedAt = request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : 'N/A';
            const status = request.status || 'PENDING';
            const isPending = status === 'PENDING';
            const isApproved = status === 'APPROVED';
            const isRejected = status === 'REJECTED';
            
            return `
            <div class="card" style="border-left: 4px solid ${isPending ? 'var(--warning-color)' : isApproved ? 'var(--success-color)' : 'var(--danger-color)'};">
                <div class="card-header">
                    <div>
                        <div class="card-title">
                            ${firstName} ${lastName}
                            ${isApproved ? '<span style="margin-left: 0.5rem; color: var(--success-color);">✓</span>' : ''}
                            ${isRejected ? '<span style="margin-left: 0.5rem; color: var(--danger-color);">✗</span>' : ''}
                        </div>
                        <div class="card-subtitle">${email}</div>
                        <div style="margin-top: 0.25rem; font-size: 0.75rem; color: var(--text-secondary);">
                            User ID: <span style="font-family: monospace;">${lawyerId}</span>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <span class="badge ${isPending ? 'badge-warning' : isApproved ? 'badge-success' : 'badge-danger'}">
                            ${isPending ? '⏳ PENDING' : isApproved ? '✓ APPROVED' : '✗ REJECTED'}
                        </span>
                        <span style="font-size: 0.75rem; color: var(--text-secondary);">
                            Submitted: ${submittedAt}
                        </span>
                    </div>
                </div>
                <div class="card-body">
                    <div style="margin-bottom: 1rem; padding: 1rem; background: ${isPending ? 'rgba(245, 158, 11, 0.1)' : isApproved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border-radius: 8px; border-left: 3px solid ${isPending ? 'var(--warning-color)' : isApproved ? 'var(--success-color)' : 'var(--danger-color)'};">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <strong style="color: ${isPending ? 'var(--warning-color)' : isApproved ? 'var(--success-color)' : 'var(--danger-color)'};">
                                ${isPending ? '⏳ VERIFICATION REQUEST PENDING' : isApproved ? '✓ VERIFICATION APPROVED' : '✗ VERIFICATION REJECTED'}
                            </strong>
                        </div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">
                            <div style="margin-bottom: 0.5rem;">
                                <strong>Account:</strong> ${firstName} ${lastName} (${email}) - User ID: <span style="font-family: monospace; font-size: 0.75rem;">${lawyerId}</span>
                            </div>
                            ${isPending 
                                ? `<div><strong>Status:</strong> This lawyer has submitted a verification request. Review their personal information and professional credentials below before verifying.</div>`
                                : isApproved
                                    ? `<div><strong>Status:</strong> This verification request has been approved. The lawyer account (${email}) is now verified and linked to the professional profile.</div>`
                                    : `<div><strong>Status:</strong> This verification request was rejected. Reason: ${request.rejectionReason || 'Not specified'}</div>`}
                            ${isRejected && reviewedBy.firstName ? `<div style="margin-top: 0.5rem;"><strong>Reviewed by:</strong> ${reviewedBy.firstName} ${reviewedBy.lastName} on ${reviewedAt}</div>` : ''}
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
                        <h4 style="margin-bottom: 0.75rem; color: var(--primary-color); display: flex; align-items: center; gap: 0.5rem;">
                            <span>👤</span> Personal Information & Account Details
                        </h4>
                        <div class="card-info">
                            <div class="info-item">
                                <span class="info-label">User ID</span>
                                <span class="info-value" style="font-size: 0.75rem; word-break: break-all;">${lawyerId}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Full Name</span>
                                <span class="info-value">${firstName} ${lastName}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Email</span>
                                <span class="info-value">${email}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Phone</span>
                                <span class="info-value">${phone}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Account Created</span>
                                <span class="info-value">${lawyer.createdAt ? new Date(lawyer.createdAt).toLocaleDateString() : 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Request Submitted</span>
                                <span class="info-value">${submittedAt}</span>
                            </div>
                            ${lawyer.profilePicture ? `
                            <div class="info-item">
                                <span class="info-label">Profile Picture</span>
                                <span class="info-value">
                                    <a href="${lawyer.profilePicture}" target="_blank" style="color: var(--primary-color);">View Image</a>
                                </span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${profile && Object.keys(profile).length > 0 ? `
                    <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
                        <h4 style="margin-bottom: 0.75rem; color: var(--primary-color); display: flex; align-items: center; gap: 0.5rem;">
                            <span>⚖️</span> Professional Information & Credentials (From Profile Form)
                        </h4>
                        <div class="card-info">
                            <div class="info-item">
                                <span class="info-label">Bar License Number</span>
                                <span class="info-value">${profile.barLicenseNumber || 'Not provided'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Specializations</span>
                                <span class="info-value">${(profile.specialization || []).length > 0 ? (profile.specialization || []).join(', ') : 'Not specified'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Years of Experience</span>
                                <span class="info-value">${profile.experience || 0} years</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Hourly Rate</span>
                                <span class="info-value" style="color: var(--success-color); font-weight: bold;">Rs. ${profile.hourlyRate || 0}/hr</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Rating</span>
                                <span class="info-value">${profile.rating ? profile.rating.toFixed(1) : '0.0'} ⭐ (${profile.totalReviews || 0} reviews)</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Verification Status</span>
                                <span class="info-value" style="color: ${profile.isVerified ? 'var(--success-color)' : 'var(--warning-color)'}; font-weight: bold;">
                                    ${profile.isVerified ? '✓ VERIFIED' : '⏳ PENDING VERIFICATION'}
                                </span>
                            </div>
                        </div>
                        ${profile.bio ? `
                        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(37, 99, 235, 0.05); border-radius: 6px;">
                            <strong style="color: var(--primary-color); display: block; margin-bottom: 0.5rem;">Bio:</strong>
                            <p style="color: var(--text-secondary); line-height: 1.6; margin: 0;">${profile.bio}</p>
                        </div>
                        ` : ''}
                        ${profile.education && profile.education.length > 0 ? `
                        <div style="margin-top: 1rem;">
                            <strong style="color: var(--primary-color); display: block; margin-bottom: 0.5rem;">Education:</strong>
                            ${profile.education.map(edu => `
                                <div style="margin-bottom: 0.25rem; color: var(--text-secondary);">
                                    ${edu.degree || 'N/A'} - ${edu.institution || 'N/A'} (${edu.year || 'N/A'})
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                        ${profile.languages && profile.languages.length > 0 ? `
                        <div style="margin-top: 1rem;">
                            <strong style="color: var(--primary-color);">Languages:</strong>
                            <span style="color: var(--text-secondary);"> ${profile.languages.join(', ')}</span>
                        </div>
                        ` : ''}
                    </div>
                    ` : '<div style="padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; color: var(--danger-color);"><strong>⚠️ Warning:</strong> Lawyer profile not found. Please ensure the lawyer has completed their profile.</div>'}
                    
                    ${isPending ? `
                        <div class="card-actions" style="margin-top: 1.5rem; padding: 1rem; background: rgba(245, 158, 11, 0.05); border: 2px dashed var(--warning-color); border-radius: 8px;">
                            <div style="margin-bottom: 0.75rem;">
                                <strong style="color: var(--warning-color); display: block; margin-bottom: 0.25rem;">Verification Action Required</strong>
                                <div style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">
                                    <div style="margin-bottom: 0.5rem;">
                                        <strong>Account to Verify:</strong> ${firstName} ${lastName} (${email})
                                    </div>
                                    <div>
                                        Review the personal information (account: ${email}) and professional credentials (license: ${profile.barLicenseNumber || 'N/A'}, experience: ${profile.experience || 0} years) above. 
                                        Set an hourly rate and click verify to approve this lawyer account. Verification will link the personal account (${email}) to the verified professional profile.
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                                <div>
                                    <label style="display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: var(--text-primary); font-weight: 500;">
                                        Set Hourly Rate (Rs.) *
                                    </label>
                                    <input type="number" 
                                           id="hourlyRate_req_${lawyerId}" 
                                           placeholder="Enter hourly rate" 
                                           value="${profile.hourlyRate || ''}" 
                                           min="0"
                                           step="0.01"
                                           required
                                           style="width: 200px; padding: 0.5rem; border: 2px solid var(--warning-color); border-radius: 6px; font-size: 1rem;">
                                </div>
                                <div style="display: flex; align-items: flex-end; gap: 0.5rem;">
                                    <button class="btn btn-success verify-from-request-btn" data-lawyer-id="${lawyerId}" data-request-id="${request._id || request.id}" style="padding: 0.75rem 1.5rem; font-weight: 600;">
                                        ✓ Verify & Approve
                                    </button>
                                    <button class="btn btn-danger reject-request-btn" data-request-id="${request._id || request.id}" style="padding: 0.75rem 1.5rem; font-weight: 600;">
                                        ✗ Reject Request
                                    </button>
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color); font-size: 0.75rem; color: var(--text-secondary);">
                                <strong>Verifying will:</strong> Approve the lawyer's profile, link the personal account (${email}) to the verified profile, allow them to set/edit hourly rates, and make them visible to clients.
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        }).join('');
    } catch (error) {
        listContainer.innerHTML = `<div class="error-message show">Error loading verification requests: ${error.message}</div>`;
    }
}

// Event delegation for verification request actions
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('verify-from-request-btn')) {
        const lawyerId = e.target.getAttribute('data-lawyer-id');
        const requestId = e.target.getAttribute('data-request-id');
        const hourlyRateInput = document.getElementById(`hourlyRate_req_${lawyerId}`);
        const hourlyRate = hourlyRateInput ? parseFloat(hourlyRateInput.value) : null;

        if (hourlyRateInput && (!hourlyRate || hourlyRate < 0)) {
            alert('Please enter a valid hourly rate');
            return;
        }

        if (!confirm('Are you sure you want to verify this lawyer? This will approve their verification request and link their personal account to the verified profile.')) {
            return;
        }

        try {
            await apiRequest(`/admin/lawyers/${lawyerId}/verify`, {
                method: 'PATCH',
                body: hourlyRate ? { hourlyRate } : {},
            });
            alert('Lawyer verified successfully! The verification request has been approved.');
            loadVerificationRequests();
            loadLawyers();
            loadDashboard();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    if (e.target.classList.contains('reject-request-btn')) {
        const requestId = e.target.getAttribute('data-request-id');
        const reason = prompt('Please provide a reason for rejection (optional):');
        
        if (reason === null) {
            return; // User cancelled
        }

        if (!confirm('Are you sure you want to reject this verification request?')) {
            return;
        }

        try {
            await apiRequest(`/admin/verification/requests/${requestId}/reject`, {
                method: 'PATCH',
                body: { rejectionReason: reason || 'Verification request rejected' },
            });
            alert('Verification request rejected successfully!');
            loadVerificationRequests();
            loadDashboard();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }
});

async function verifyLawyerFromRequest(lawyerId, requestId) {
    const hourlyRateInput = document.getElementById(`hourlyRate_req_${lawyerId}`);
    const hourlyRate = hourlyRateInput ? parseFloat(hourlyRateInput.value) : null;

    if (hourlyRateInput && (!hourlyRate || hourlyRate < 0)) {
        alert('Please enter a valid hourly rate');
        return;
    }

    if (!confirm('Are you sure you want to verify this lawyer? This will approve their verification request and link their personal account to the verified profile.')) {
        return;
    }

    try {
        await apiRequest(`/admin/lawyers/${lawyerId}/verify`, {
            method: 'PATCH',
            body: hourlyRate ? { hourlyRate } : {},
        });
        alert('Lawyer verified successfully! The verification request has been approved.');
        loadVerificationRequests();
        loadLawyers();
        loadDashboard();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function rejectVerificationRequest(requestId) {
    const reason = prompt('Please provide a reason for rejection (optional):');
    
    if (reason === null) {
        return; // User cancelled
    }

    if (!confirm('Are you sure you want to reject this verification request?')) {
        return;
    }

    try {
        await apiRequest(`/admin/verification/requests/${requestId}/reject`, {
            method: 'PATCH',
            body: { rejectionReason: reason || 'Verification request rejected' },
        });
        alert('Verification request rejected successfully!');
        loadVerificationRequests();
        loadDashboard();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Statistics Functions
async function loadStats() {
    try {
        const stats = await apiRequest('/admin/stats');
        document.getElementById('statsTotalUsers').textContent = (stats.data.totalUsers || 0) - (stats.data.totalAdmins || 0);
        document.getElementById('statsTotalLawyers').textContent = stats.data.totalLawyers || 0;
        document.getElementById('statsTotalClients').textContent = stats.data.totalClients || 0;
        document.getElementById('statsPendingVerifications').textContent = stats.data.pendingVerifications || 0;
        document.getElementById('statsTotalAppointments').textContent = stats.data.totalAppointments || 0;
        document.getElementById('statsTotalTemplates').textContent = stats.data.totalTemplates || 0;
        document.getElementById('statsTotalDocuments').textContent = stats.data.totalDocuments || 0;
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('statsContent').innerHTML = `<div class="error-message show">Error loading statistics: ${error.message}</div>`;
    }
}

// Event Listeners
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        await login(email, password);
    } catch (error) {
        showError('loginError', error.message);
    }
});

document.getElementById('logoutBtn').addEventListener('click', logout);

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.target.getAttribute('data-page');
        if (!page) {
            console.error('No data-page attribute found on nav link');
            return;
        }
        
        // Convert kebab-case to camelCase for page ID
        const pageIdMap = {
            'dashboard': 'dashboardPage',
            'verification-requests': 'verificationRequestsPage',
            'lawyers': 'lawyersPage',
            'users': 'usersPage',
            'stats': 'statsPage'
        };
        
        const pageId = pageIdMap[page] || `${page}Page`;
        showPage(pageId);

        if (page === 'lawyers') {
            loadLawyers();
        } else if (page === 'users') {
            loadUsers();
        } else if (page === 'stats') {
            loadStats();
        } else if (page === 'verification-requests') {
            loadVerificationRequests();
        } else if (page === 'dashboard') {
            loadDashboard();
        }
    });
});

document.getElementById('refreshLawyersBtn').addEventListener('click', loadLawyers);
document.getElementById('refreshUsersBtn').addEventListener('click', loadUsers);
document.getElementById('refreshRequestsBtn').addEventListener('click', loadVerificationRequests);
document.getElementById('showOnlyUnverified').addEventListener('change', loadLawyers);
document.getElementById('userRoleFilter').addEventListener('change', loadUsers);
document.getElementById('requestStatusFilter').addEventListener('change', loadVerificationRequests);

// Initialize
if (authToken) {
    // Try to verify token by getting current user
    apiRequest('/auth/me')
        .then(response => {
            if (response.success && response.data.user.role === 'ADMIN') {
                currentUser = response.data.user;
                showScreen('dashboardScreen');
                loadDashboard();
            } else {
                logout();
            }
        })
        .catch(() => {
            logout();
        });
} else {
    showScreen('loginScreen');
}

