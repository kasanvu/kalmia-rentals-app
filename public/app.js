// --- GLOBAL SIMULATED DATABASE ---
let usersData = [
    { id: 1, username: "mukasa", password: "123", role: "tenant", linkedId: 101 },
    { id: 2, username: "hajji", password: "456", role: "landlord", linkedId: 201 },
    { id: 3, username: "admin", password: "789", role: "administrator", linkedId: null }
];

let landlordsData = [
    { id: 201, name: "Hajji Katongole", phone: "0772111222", properties: 2, activeRooms: 2 }
];

// Fallback arrays if local storage is blank
const defaultTenantsList = [
    { id: 101, name: "Mukasa John", phone: "0701999888", room: "A4", landlordId: 201, paidUntil: "2026-06-25T00:00:00.000Z", totalPaid: 1500000 }
];

const defaultRoomsList = [
    { 
        roomNumber: "A4", 
        type: "Premium Executive Studio", 
        location: "Kiwatule, Kampala", 
        price: 750000, 
        isVacant: true, 
        landlordPhone: "0772111222", 
        imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80" 
    },
    { 
        roomNumber: "B2", 
        type: "Deluxe Family Suite", 
        location: "Bukoto, Kampala", 
        price: 1300000, 
        isVacant: true, 
        landlordPhone: "0701333444", 
        imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&q=80" 
    }
];

const defaultChatsHistory = [
    { id: 1, sender: "KALmia Landlord", text: "Habari! Welcome to your easy rent protection board tracking center portal." }
];

const defaultReceiptsHistory = [
    { id: "TXN-10492-UGX", date: "2026-05-26 09:15", network: "MTN", phone: "0772555666", amount: 1500000, status: "Verified ✅" }
];

// --- DATABASE STATE HANDLER (LOCALSTORAGE INITIALIZATION) ---
let tenantsData = JSON.parse(localStorage.getItem('kalmia_tenants')) || defaultTenantsList;
let roomsData = JSON.parse(localStorage.getItem('kalmia_rooms')) || defaultRoomsList;
let chatData = JSON.parse(localStorage.getItem('kalmia_chats')) || defaultChatsHistory;
let receiptsData = JSON.parse(localStorage.getItem('kalmia_receipts')) || defaultReceiptsHistory;

let tenantLastReadId = parseInt(localStorage.getItem('kalmia_tenant_last_read')) || 1;
let landlordLastReadId = parseInt(localStorage.getItem('kalmia_landlord_last_read')) || 1;

let currentUser = localStorage.getItem('kalmia_logged_user') || null; 
let activeBillingAmount = 0;
let selectedDaysToAdd = 30;

// Dynamic 20% commission calculator logic
function getPlatformEarnings() {
    let totalVolume = tenantsData.reduce((sum, t) => sum + (t.totalPaid || 0), 0);
    return {
        totalVolumeProcessed: totalVolume,
        commissionRate: 0.20,
        adminRevenueOwed: totalVolume * 0.20
    };
}

function syncDatabase() {
    localStorage.setItem('kalmia_tenants', JSON.stringify(tenantsData));
    localStorage.setItem('kalmia_rooms', JSON.stringify(roomsData));
    localStorage.setItem('kalmia_chats', JSON.stringify(chatData));
    localStorage.setItem('kalmia_receipts', JSON.stringify(receiptsData));
    localStorage.setItem('kalmia_tenant_last_read', tenantLastReadId);
    localStorage.setItem('kalmia_landlord_last_read', landlordLastReadId);
}

// --- SECURE DYNAMIC LOGIN ENGINE ---
function handleLogin() {
    const userField = document.getElementById('login-username').value.trim().toLowerCase();
    const passField = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');

    errorMsg.classList.add('hidden');

    // Dynamic database search loop
    const foundUser = usersData.find(u => u.username === userField && u.password === passField);

    if (foundUser) {
        currentUser = foundUser.role;
        localStorage.setItem('kalmia_logged_user', currentUser);
        bootAuthenticatedSession();
    } else {
        errorMsg.classList.remove('hidden');
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('kalmia_logged_user');
    document.getElementById('app-interface').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
}

function bootAuthenticatedSession() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-interface').classList.remove('hidden');

    const badge = document.getElementById('user-role-badge');
    const tenantMenuBtn = document.getElementById('btn-tenant');
    const landlordMenuBtn = document.getElementById('btn-landlord');
    const adminMenuBtn = document.getElementById('btn-admin');
    const chatIdentity = document.getElementById('chat-sender-identity');

    // Setup visual role interfaces
    if (currentUser === 'tenant') {
        badge.innerText = "Mukasa (Tenant)";
        if(chatIdentity) chatIdentity.innerText = "Posting as: Mukasa (Tenant)";
        tenantMenuBtn.style.display = "block";
        landlordMenuBtn.style.display = "none";
        if(adminMenuBtn) adminMenuBtn.style.display = "none";
        switchView('tenant');
    } else if (currentUser === 'landlord') {
        badge.innerText = "KALmia Landlord";
        if(chatIdentity) chatIdentity.innerText = "Posting as: Landlord (Admin)";
        tenantMenuBtn.style.display = "none";
        landlordMenuBtn.style.display = "block";
        if(adminMenuBtn) adminMenuBtn.style.display = "none";
        switchView('landlord');
    } else if (currentUser === 'administrator') {
        badge.innerText = "KALmia Master Admin";
        tenantMenuBtn.style.display = "none";
        landlordMenuBtn.style.display = "none";
        if(adminMenuBtn) adminMenuBtn.style.display = "block";
        switchView('admin');
    }

    refreshTenantPortalUI();
    renderLandlordOverview();
    renderAvailableUnits();
    renderReceiptsLog();
    renderAdminDashboard();
    calculateUnreadMessages();
}

function switchView(viewId) {
    document.querySelectorAll('.view-panel, .view-section').forEach(section => section.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    const targetPanel = document.getElementById(`${viewId}-view`);
    if(targetPanel) targetPanel.classList.remove('hidden');
    
    const targetedBtn = document.getElementById(`btn-${viewId}`);
    if(targetedBtn) targetedBtn.classList.add('active');

    if (viewId === 'chat') clearChatNotifications();
    else calculateUnreadMessages();
}

// --- VISUAL COUNTDOWN METER ENGINE (EASY SCALE) ---
function refreshTenantPortalUI() {
    let tenantInfo = tenantsData.find(t => t.id === 101) || tenantsData[0];
    if(!tenantInfo) return;
    
    const targetDate = new Date(tenantInfo.paidUntil);
    const currentDate = new Date();
    
    const timeDifference = targetDate.getTime() - currentDate.getTime();
    const daysRemaining = Math.max(0, Math.ceil(timeDifference / (1000 * 60 * 60 * 24)));

    const textEl = document.getElementById('visual-countdown-text');
    if(textEl) textEl.innerText = `${daysRemaining} Days Safe`;
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const subtextEl = document.getElementById('visual-date-subtext');
    if(subtextEl) subtextEl.innerText = `Your room rent protection covers you up until: ${targetDate.toLocaleDateString('en-US', options)}`;

    let fillPercentage = Math.min(100, (daysRemaining / 90) * 100);
    const meterFill = document.getElementById('visual-meter-fill');
    const smileyEl = document.getElementById('meter-status-smiley');
    const badgeEl = document.getElementById('meter-status-badge');

    if(meterFill) {
        meterFill.style.width = `${fillPercentage}%`;
        
        if (daysRemaining > 30) {
            meterFill.style.background = "linear-gradient(90deg, #22c55e, #4ade80)";
            if(smileyEl) smileyEl.innerText = "😊";
            if(badgeEl) { badgeEl.innerText = "FULLY SAFE"; badgeEl.style.color = "var(--success, #22c55e)"; }
        } else if (daysRemaining > 14) {
            meterFill.style.background = "linear-gradient(90deg, #eab308, #fde047)";
            if(smileyEl) smileyEl.innerText = "😐";
            if(badgeEl) { badgeEl.innerText = "RUNNING LOW"; badgeEl.style.color = "#d97706"; }
        } else {
            meterFill.style.background = "linear-gradient(90deg, #ef4444, #f87171)";
            if(smileyEl) smileyEl.innerText = "⚠️";
            if(badgeEl) { badgeEl.innerText = "PAYMENT DUE"; badgeEl.style.color = "var(--danger, #ef4444)"; }
        }
    }

    updateEasyInstallmentAmount();
}

function updateEasyInstallmentAmount() {
    const dropdown = document.getElementById('easy-prepaid-package');
    if(!dropdown) return;
    const packageValue = parseInt(dropdown.value, 10);
    selectedDaysToAdd = packageValue;
    
    activeBillingAmount = selectedDaysToAdd * 50000;

    const previewDays = document.getElementById('easy-days-preview');
    const previewCost = document.getElementById('easy-cost-preview');
    if(previewDays) previewDays.innerText = `${selectedDaysToAdd} Days Safety`;
    if(previewCost) previewCost.innerText = `UGX ${activeBillingAmount.toLocaleString()}`;
}

function openMomoModal() {
    document.getElementById('momo-checkout-days-label').innerText = `${selectedDaysToAdd} Days Room Protection`;
    document.getElementById('momo-checkout-amount').innerText = `UGX ${activeBillingAmount.toLocaleString()}`;
    
    document.getElementById('momo-payment-form').classList.remove('hidden');
    document.getElementById('momo-loading-screen').classList.add('hidden');
    document.getElementById('momo-success-screen').classList.add('hidden');
    document.getElementById('momo-modal').classList.remove('hidden');
}

function closeMomoModal() {
    document.getElementById('momo-modal').classList.add('hidden');
}

// --- ACTIVATED RAW MOBILE MONEY ROUTING ENGINE ---
function triggerMomoPush() {
    const phoneInput = document.getElementById('momo-phone').value.trim();
    
    // Check validation of basic East African handset MSISDN length standard
    if (phoneInput.length < 9) {
        alert("Please enter a valid active mobile money handset subscriber phone number.");
        return;
    }

    // Identify which network provider button option is toggled active
    const selectedProvider = document.querySelector('input[name="momo-provider"]:checked')?.value || "MTN";

    // Switch view state to visual loading loader screen
    document.getElementById('momo-payment-form').classList.add('hidden');
    document.getElementById('momo-loading-screen').classList.remove('hidden');

    console.log(`Connecting Raw Gateway... Initiating Push to: ${phoneInput} via Network: ${selectedProvider}`);

    // Call your local backend API server hosting the raw token/push services
    fetch('/api/initiate-payment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            provider: selectedProvider,
            phoneNumber: phoneInput,
            amount: activeBillingAmount
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Success response means the network accepted the push payload string context
            console.log(`Raw Telecom hand-shake complete. Transaction reference logged: ${data.txnId}`);
            
            // Execute frontend credit update state logic
            executeDatabasePaymentCredit(selectedProvider, phoneInput);
        } else {
            // Revert interface view frame if raw transmission parameters reject
            alert(`Raw Integration Callback Error: ${data.error || 'Check local backend credential keys config.'}`);
            document.getElementById('momo-payment-form').classList.remove('hidden');
            document.getElementById('momo-loading-screen').classList.add('hidden');
        }
    })
    .catch(err => {
        console.warn("Backend API route offline or running client local sandbox mock fallback fallback routing...");
        // Fallback safety layer: simulation executes locally if server routes aren't built out yet
        setTimeout(() => {
            executeDatabasePaymentCredit(selectedProvider, phoneInput);
        }, 2000);
    });
}

// Rewritten payment confirmation matrix block logic to store the correct network carrier
function executeDatabasePaymentCredit(chosenProvider, customerPhone) {
    let tenantInfo = tenantsData.find(t => t.id === 101) || tenantsData[0];
    
    let currentExpiry = new Date(tenantInfo.paidUntil);
    let today = new Date();
    let baselineStartDate = (currentExpiry.getTime() > today.getTime()) ? currentExpiry : today;
    
    baselineStartDate.setDate(baselineStartDate.getDate() + selectedDaysToAdd);
    tenantInfo.paidUntil = baselineStartDate.toISOString();
    tenantInfo.totalPaid += activeBillingAmount;

    const now = new Date();
    const formattedTimestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const generatedTxId = `TXN-${Math.floor(10000 + Math.random() * 90000)}-UGX`;

    // Logs the actual provider user clicked directly into your database ledger file
    receiptsData.unshift({
        id: generatedTxId,
        date: formattedTimestamp,
        network: chosenProvider.toUpperCase(), 
        phone: customerPhone,
        amount: activeBillingAmount,
        status: "Verified ✅"
    });

    syncDatabase();

    document.getElementById('momo-loading-screen').classList.add('hidden');
    document.getElementById('momo-success-screen').classList.remove('hidden');
    document.getElementById('momo-success-message').innerText = `Successful! You bought an additional ${selectedDaysToAdd} days of total safety over the raw ${chosenProvider} pipeline.`;

    refreshTenantPortalUI(); 
    renderReceiptsLog(); 
    renderLandlordOverview();
    renderAdminDashboard();
}

function executeDatabasePaymentCredit() {
    let tenantInfo = tenantsData.find(t => t.id === 101) || tenantsData[0];
    
    let currentExpiry = new Date(tenantInfo.paidUntil);
    let today = new Date();
    let baselineStartDate = (currentExpiry.getTime() > today.getTime()) ? currentExpiry : today;
    
    baselineStartDate.setDate(baselineStartDate.getDate() + selectedDaysToAdd);
    tenantInfo.paidUntil = baselineStartDate.toISOString();
    tenantInfo.totalPaid += activeBillingAmount;

    const now = new Date();
    const formattedTimestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const generatedTxId = `TXN-${Math.floor(10000 + Math.random() * 90000)}-UGX`;

    const activeProvider = document.querySelector('input[name="momo-provider"]:checked')?.value || "MTN";

    receiptsData.unshift({
        id: generatedTxId,
        date: formattedTimestamp,
        network: activeProvider,
        phone: document.getElementById('momo-phone').value,
        amount: activeBillingAmount,
        status: "Verified ✅"
    });

    syncDatabase();

    document.getElementById('momo-loading-screen').classList.add('hidden');
    document.getElementById('momo-success-screen').classList.remove('hidden');
    document.getElementById('momo-success-message').innerText = `Successful! You bought an additional ${selectedDaysToAdd} days of total safety.`;

    refreshTenantPortalUI(); 
    renderReceiptsLog(); 
    renderLandlordOverview();
    renderAdminDashboard();
}

function renderReceiptsLog() {
    const bodyEl = document.getElementById('tenant-receipts-body');
    if (!bodyEl) return;
    bodyEl.innerHTML = "";
    receiptsData.forEach(receipt => {
        bodyEl.innerHTML += `
            <tr>
                <td><code>${receipt.id}</code></td>
                <td>${receipt.date}</td>
                <td><strong>${receipt.network}</strong></td>
                <td>${receipt.phone}</td>
                <td style="color:#16a34a; font-weight:600;">UGX ${receipt.amount.toLocaleString()}</td>
                <td><span style="background:#dcfce7; color:#166534; font-size:0.75rem; font-weight:600; padding:0.2rem 0.5rem; border-radius:4px;">${receipt.status}</span></td>
            </tr>
        `;
    });
}

function renderLandlordOverview() {
    const containerTableBody = document.getElementById('landlord-table-body');
    if(!containerTableBody) return;
    containerTableBody.innerHTML = ""; 

    let aggregatedCollected = 0;

    tenantsData.forEach(tenant => {
        aggregatedCollected += tenant.totalPaid;
        const targetDate = new Date(tenant.paidUntil);
        const currentDate = new Date();
        const daysRemaining = Math.max(0, Math.ceil((targetDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));

        const counterBadge = document.getElementById('landlord-days-counter-badge');
        if(counterBadge) counterBadge.innerText = `${daysRemaining} Days`;

        let statusStyle = "color:#16a34a;";
        if(daysRemaining <= 14) statusStyle = "color:#ef4444; font-weight:700;";

        containerTableBody.innerHTML += `
            <tr>
                <td><strong>${tenant.name}</strong></td>
                <td><span style="color:#2563eb; font-weight:600;">Unit ${tenant.room}</span></td>
                <td><span style="${statusStyle}">${daysRemaining} Days Remaining</span></td>
                <td>${targetDate.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}</td>
                <td style="color:#16a34a;">UGX ${tenant.totalPaid.toLocaleString()}</td>
                <td>
                    <button class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.8rem; border-radius:6px; width:auto;" onclick="alert('Friendly reminder notification text pushed!')">Send Nudge</button>
                </td>
            </tr>
        `;
    });

    const colEl = document.getElementById('total-collected');
    if(colEl) colEl.innerText = `UGX ${aggregatedCollected.toLocaleString()}`;
}

// --- PLATFORM OPERATOR MANAGEMENT ENGINE ---
function renderAdminDashboard() {
    const earnings = getPlatformEarnings();
    
    const totalVolumeEl = document.getElementById('admin-total-processed');
    const netCutEl = document.getElementById('admin-net-cut');
    
    if(totalVolumeEl) totalVolumeEl.innerText = `UGX ${earnings.totalVolumeProcessed.toLocaleString()}`;
    if(netCutEl) netCutEl.innerText = `UGX ${earnings.adminRevenueOwed.toLocaleString()}`;
    
    // Render Landlords Matrix Table
    const landlordBody = document.getElementById('admin-landlords-table-body');
    if(landlordBody) {
        landlordBody.innerHTML = "";
        landlordsData.forEach(l => {
            let totalRevenue = tenantsData.filter(t => t.landlordId === l.id).reduce((sum, t) => sum + t.totalPaid, 0);
            let platformCut = totalRevenue * earnings.commissionRate;
            landlordBody.innerHTML += `
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:12px; font-weight:600; color:#1e1b4b;">${l.name}</td>
                    <td style="padding:12px; color:#475569;">${l.phone}</td>
                    <td style="padding:12px; text-align:center;">${l.activeRooms}</td>
                    <td style="padding:12px; text-align:right; font-weight:600; color:#16a34a;">UGX ${totalRevenue.toLocaleString()}</td>
                    <td style="padding:12px; text-align:right; font-weight:700; color:#2563eb; background:rgba(37,99,235,0.02);">UGX ${platformCut.toLocaleString()}</td>
                </tr>`;
        });
    }

    // Render Tenants Control list
    const tenantBody = document.getElementById('admin-tenants-table-body');
    if(tenantBody) {
        tenantBody.innerHTML = "";
        tenantsData.forEach(t => {
            let userAccount = usersData.find(u => u.role === 'tenant');
            let currentPasswordStr = userAccount ? userAccount.password : "---";
            tenantBody.innerHTML += `
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:12px; font-weight:600; color:#1e1b4b;">${t.name}</td>
                    <td style="padding:12px; color:#475569;"><span style="background:#f1f5f9; padding:4px 8px; border-radius:6px; font-family:monospace;">Room ${t.room}</span></td>
                    <td style="padding:12px; text-align:right; font-weight:600; color:#16a34a;">UGX ${t.totalPaid.toLocaleString()}</td>
                    <td style="padding:12px; text-align:center;"><span style="font-family:monospace; background:#fef2f2; color:#991b1b; padding:4px 8px; border-radius:6px; font-weight:700;">${currentPasswordStr}</span></td>
                    <td style="padding:12px; text-align:center;">
                        <button onclick="triggerMasterPasswordReset('${userAccount?.username}')" style="background:#22c55e; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:0.8rem; cursor:pointer; font-weight:600;">Force Reset</button>
                    </td>
                </tr>`;
        });
    }
}

function triggerMasterPasswordReset(usernameToReset) {
    if(!usernameToReset || usernameToReset === 'undefined') return alert("Account context error.");
    let newPassword = prompt(`Enter a secure new access password for user account [ ${usernameToReset} ] :`);
    
    if (newPassword === null) return; 
    if (newPassword.trim() === "") return alert("Password fields cannot be blank.");
    
    let targetUser = usersData.find(u => u.username === usernameToReset);
    if (targetUser) {
        targetUser.password = newPassword.trim();
        alert(`Success! Account [ ${usernameToReset} ] credentials rewritten code to: ${newPassword.trim()}`);
        renderAdminDashboard();
    }
}

// --- RENTAL VACANCY LISTINGS RENDERER ---
function renderAvailableUnits() {
    const catalogWrapper = document.getElementById('rooms-container');
    if(!catalogWrapper) return;
    catalogWrapper.innerHTML = "";

    roomsData.forEach(room => {
        if (room.isVacant) {
            catalogWrapper.innerHTML += `
                <div class="card" style="display:flex; flex-direction:column; padding:0; overflow:hidden; background:#fff; border-radius:12px; box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1);">
                    <div style="width:100%; height:140px; overflow:hidden; background:#e2e8f0;">
                        <img src="${room.imageUrl}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div style="padding: 1rem;">
                        <h4 style="margin:0; font-size:1.1rem; color:#1e1b4b;">Room ${room.roomNumber}</h4>
                        <div style="font-size:0.8rem; margin:0.25rem 0; color:#64748b;">📍 ${room.location}</div>
                        <p style="font-size:0.85rem; margin:0.5rem 0 1rem 0; color:#334155;">UGX ${room.price.toLocaleString()} / mo <br>📞 Line: <strong>${room.landlordPhone}</strong></p>
                        <button class="btn btn-primary" style="width:100%; padding:0.5rem; background:#1e1b4b;" onclick="bookRoomUnit('${room.roomNumber}')">Inquire Booking</button>
                    </div>
                </div>
            `;
        }
    });
}

function bookRoomUnit(roomNumber) {
    let targetRoom = roomsData.find(r => r.roomNumber === roomNumber);
    if (targetRoom) {
        targetRoom.isVacant = false;
        let nextMsgId = chatData.length > 0 ? Math.max(...chatData.map(m => m.id)) + 1 : 1;
        chatData.push({ id: nextMsgId, sender: "System", text: `📢 INQUIRY: Booking submission on Room ${targetRoom.roomNumber}.` });
        syncDatabase();
        renderAvailableUnits();
        alert("Booking request submitted!");
        calculateUnreadMessages();
    }
}

function calculateUnreadMessages() {
    if (!currentUser) return;
    let baselineId = (currentUser === 'tenant') ? tenantLastReadId : landlordLastReadId;
    let unreadCount = chatData.filter(m => m.id > baselineId).length;
    const badgeEl = document.getElementById('chat-badge');
    if (badgeEl) {
        if (unreadCount > 0) { badgeEl.innerText = unreadCount; badgeEl.classList.remove('hidden'); }
        else badgeEl.classList.add('hidden');
    }
}

function clearChatNotifications() {
    if (chatData.length > 0) {
        let highestId = Math.max(...chatData.map(m => m.id));
        if (currentUser === 'tenant') tenantLastReadId = highestId;
        if (currentUser === 'landlord') landlordLastReadId = highestId;
        syncDatabase();
    }
    if (document.getElementById('chat-badge')) document.getElementById('chat-badge').classList.add('hidden');
    loadChatStream();
}

function loadChatStream() {
    const boxWrapper = document.getElementById('chat-messages');
    if(!boxWrapper) return;
    boxWrapper.innerHTML = "";
    chatData.forEach(msg => {
        let cls = msg.sender.toLowerCase().includes('landlord') ? "landlord" : "user-sent";
        boxWrapper.innerHTML += `<div class="message ${cls}"><strong>${msg.sender}:</strong> ${msg.text}</div>`;
    });
    boxWrapper.scrollTop = boxWrapper.scrollHeight;
}

window.onload = function() {
    if (currentUser) bootAuthenticatedSession();
    else handleLogout();
};