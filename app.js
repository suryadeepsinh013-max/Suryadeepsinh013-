/**
 * L'Étoile Dorée Parisian Bistro
 * Core Frontend Javascript Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // GLOBAL STATE MANAGEMENT
    // ----------------------------------------------------
    const state = {
        menu: [],
        tables: [],
        orders: [],
        reservations: [],
        analytics: {},
        activeTab: 'dashboard',
        
        // POS Selection states
        posSelectedTableId: null,
        posActiveCart: {
            items: [], // Array of { id, name, price, quantity, notes }
            discount: 0.0
        },
        posCategoryFilter: 'All',
        posSearchQuery: '',

        // Table Planner Selection state
        plannerSelectedTableId: null,
        plannerSectionFilter: 'All',

        // Menu Manager states
        menuSearchQuery: '',
        menuCategoryFilter: 'All',

        // Staff Manager states
        staff: [],
        staffSearchQuery: '',
        staffRoleFilter: 'All',

        // Active Session User state
        currentUser: null
    };

    // ----------------------------------------------------
    // INITIALIZATION & EVENT LISTENERS
    // ----------------------------------------------------
    function init() {
        setupTabRouter();
        setupClock();
        setupGlobalEventListeners();
        setupLoginScreen();

        // Setup 10-second data polling to keep Kitchen & Dashboard in sync
        setInterval(() => {
            if (state.currentUser) {
                loadAllData(true);
            }
        }, 10000);
    }

    // ----------------------------------------------------
    // API UTILITIES
    // ----------------------------------------------------
    async function fetchAPI(url, options = {}) {
        try {
            if (!options.headers) {
                options.headers = {};
            }
            if (options.body && typeof options.body === 'object') {
                options.body = JSON.stringify(options.body);
                options.headers['Content-Type'] = 'application/json';
            }
            
            const response = await fetch(url, options);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Error on ${url}:`, error);
            showNotification(error.message, 'danger');
            throw error;
        }
    }

    async function loadAllData(silent = false) {
        if (!silent) {
            // Option to show loading spinner / indicators if necessary
        }
        try {
            const [menu, tables, orders, reservations, analytics, staff] = await Promise.all([
                fetchAPI('/api/menu'),
                fetchAPI('/api/tables'),
                fetchAPI('/api/orders'),
                fetchAPI('/api/reservations'),
                fetchAPI('/api/analytics'),
                fetchAPI('/api/staff')
            ]);

            state.menu = menu;
            state.tables = tables;
            state.orders = orders;
            state.reservations = reservations;
            state.analytics = analytics;
            state.staff = staff;

            // Update badge in sidebar for active kitchen orders
            updateKitchenBadge();
            
            // Rerender currently active view to show updated data
            if (silent) {
                renderCurrentView();
            }
        } catch (error) {
            console.error('Failed to load application data:', error);
        }
    }

    function updateKitchenBadge() {
        const badge = document.getElementById('kitchen-count-badge');
        if (!badge) return;
        const activeCount = state.orders.filter(o => 
            !o.is_paid && ['Received', 'Preparing', 'Ready to Serve'].includes(o.status)
        ).length;
        
        if (activeCount > 0) {
            badge.textContent = activeCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    // ----------------------------------------------------
    // UI NAVIGATION / ROUTER
    // ----------------------------------------------------
    function setupTabRouter() {
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        const viewPanels = document.querySelectorAll('.view-panel');
        const viewTitle = document.getElementById('active-tab-title');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.getAttribute('data-tab');
                if (!tab) return;

                // Toggle active nav class
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // Toggle active view panel
                viewPanels.forEach(panel => panel.classList.remove('active'));
                const targetPanel = document.getElementById(`view-${tab}`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }

                // Update title
                state.activeTab = tab;
                const tabTitles = {
                    dashboard: 'Dashboard Hub',
                    pos: 'Point of Sale (POS)',
                    tables: 'Table Planner Layout',
                    menu: 'Menu Manager',
                    kitchen: 'Kitchen Operations'
                };
                if (viewTitle) {
                    viewTitle.textContent = tabTitles[tab] || 'Shahi Darbar';
                }

                renderCurrentView();
            });
        });
    }

    function setupClock() {
        function updateClock() {
            const liveClock = document.getElementById('live-clock');
            if (!liveClock) return;
            const now = new Date();
            const options = { month: 'short', day: 'numeric', year: 'numeric' };
            const dateStr = now.toLocaleDateString('en-US', options);
            const timeStr = now.toTimeString().split(' ')[0];
            liveClock.innerHTML = `<i class="fa-regular fa-clock"></i> ${dateStr} ${timeStr}`;
        }
        updateClock();
        setInterval(updateClock, 1000);
    }

    function setupLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const appContainer = document.querySelector('.app-container');
        const selectStaff = document.getElementById('login-staff-select');
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('login-error');
        const logoutBtn = document.getElementById('btn-logout');

        // Populate dropdown from API
        fetchAPI('/api/staff').then(staff => {
            state.staff = staff;
            if (selectStaff) {
                selectStaff.innerHTML = '<option value="" disabled selected>Choose your profile...</option>';
                staff.forEach(member => {
                    const opt = document.createElement('option');
                    opt.value = member.id;
                    opt.textContent = `${member.name} (${member.role})`;
                    selectStaff.appendChild(opt);
                });
            }
        }).catch(err => {
            console.error("Failed to load staff roster for login selection:", err);
        });

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const selectedId = selectStaff.value;
                const user = state.staff.find(s => s.id === selectedId);

                if (user) {
                    // Login successful!
                    state.currentUser = user;
                    
                    if (loginScreen) loginScreen.style.display = 'none';
                    if (appContainer) appContainer.classList.remove('hidden');

                    applyRoleAccessControl();

                    loadAllData().then(() => {
                        renderCurrentView();
                    });
                } else {
                    if (loginError) {
                        loginError.style.display = 'flex';
                    }
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                state.currentUser = null;
                if (loginScreen) loginScreen.style.display = 'flex';
                if (appContainer) appContainer.classList.add('hidden');
                if (selectStaff) selectStaff.value = "";
                if (loginError) loginError.style.display = 'none';
            });
        }
    }

    function applyRoleAccessControl() {
        const user = state.currentUser;
        if (!user) return;

        const loggedUsername = document.getElementById('logged-username');
        const loggedRole = document.getElementById('logged-role');
        if (loggedUsername) loggedUsername.textContent = user.name;
        if (loggedRole) loggedRole.textContent = user.role;

        const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        let defaultTab = 'dashboard';

        if (user.role === 'Chef') {
            defaultTab = 'kitchen';
        } else if (user.role === 'Server') {
            defaultTab = 'pos';
        }

        navItems.forEach(item => {
            const tab = item.getAttribute('data-tab');
            let isVisible = false;

            if (user.role === 'General Manager') {
                isVisible = true;
            } else if (user.role === 'Server') {
                isVisible = ['pos', 'tables', 'menu'].includes(tab);
            } else if (user.role === 'Chef') {
                isVisible = ['kitchen'].includes(tab);
            }

            if (isVisible) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });

        const defaultNavItem = document.querySelector(`.sidebar-nav .nav-item[data-tab="${defaultTab}"]`);
        if (defaultNavItem) {
            defaultNavItem.click();
        }
    }

    function renderCurrentView() {
        switch (state.activeTab) {
            case 'dashboard':
                renderDashboard();
                break;
            case 'pos':
                renderPOS();
                break;
            case 'tables':
                renderTablePlanner();
                break;
            case 'menu':
                renderMenuManager();
                break;
            case 'staff':
                renderStaff();
                break;
            case 'kitchen':
                renderKitchenView();
                break;
        }
    }

    // ----------------------------------------------------
    // NOTIFICATION COMPONENT
    // ----------------------------------------------------
    function showNotification(message, type = 'success') {
        // Simple toast notification system
        const container = document.body;
        const toast = document.createElement('div');
        toast.className = `badge badge-${type}`;
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '8px';
        toast.style.fontSize = '0.9rem';
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
        toast.style.zIndex = '9999';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.transform = 'translateY(10px)';
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}" style="margin-right: 8px;"></i> ${message}`;

        container.appendChild(toast);
        
        // Trigger reflow
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3500);
    }

    // ----------------------------------------------------
    // DASHBOARD HUB
    // ----------------------------------------------------
    function renderDashboard() {
        const data = state.analytics;
        if (!data) return;

        // Populate cards
        document.getElementById('stat-revenue').textContent = `₹${(data.revenue || 0).toFixed(2)}`;
        document.getElementById('stat-occupancy').textContent = `${data.occupancy_rate || 0}%`;
        document.getElementById('stat-active-orders').textContent = data.active_orders_count || 0;
        
        // Calculate Total reservations for today
        const todayStr = new Date().toISOString().substring(0, 10);
        const todayReservations = state.reservations.filter(r => r.date === todayStr || r.date === "2026-05-28").length;
        document.getElementById('stat-reservations').textContent = todayReservations;

        // Render Popular Gastronomy
        const popularContainer = document.getElementById('popular-items-container');
        if (popularContainer) {
            if (data.popular_items && data.popular_items.length > 0) {
                popularContainer.innerHTML = data.popular_items.map((item, idx) => `
                    <div class="popular-row">
                        <div class="pop-info">
                            <span class="pop-name">${item.name}</span>
                            <span class="pop-meta">Signature Gastronomy</span>
                        </div>
                        <span class="pop-sales">${item.sales} sold</span>
                    </div>
                `).join('');
            } else {
                popularContainer.innerHTML = '<div class="loading-placeholder">No sales records registered yet.</div>';
            }
        }

        // Render Recent Transactions
        const timelineContainer = document.getElementById('recent-sales-timeline');
        if (timelineContainer) {
            if (data.sales_timeline && data.sales_timeline.length > 0) {
                timelineContainer.innerHTML = data.sales_timeline.map(invoice => `
                    <div class="timeline-item">
                        <div class="tl-body">
                            <div>
                                <span class="tl-title">${invoice.table}</span>
                                <span class="tl-time">at ${invoice.time || '12:00'}</span>
                            </div>
                            <span class="tl-amount">+₹${invoice.amount.toFixed(2)}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                timelineContainer.innerHTML = '<div class="loading-placeholder">No settled payments yet today.</div>';
            }
        }

        // Draw custom interactive SVG chart
        drawAnalyticsChart(data);
    }

    function drawAnalyticsChart(analytics) {
        const container = document.getElementById('analytics-chart');
        if (!container) return;

        const svgWidth = container.clientWidth || 550;
        const svgHeight = 220;

        // Default profile hourly activity
        const dataPoints = [
            { label: '12:00', value: 120 },
            { label: '14:00', value: 340 },
            { label: '16:00', value: 190 },
            { label: '18:00', value: 580 },
            { label: '20:00', value: 890 },
            { label: '22:00', value: 450 }
        ];

        // Adjust 20:00 / last point if today's revenue is higher
        if (analytics.revenue && analytics.revenue > 0) {
            dataPoints[4].value = Math.max(890, Math.round(analytics.revenue * 0.4));
            dataPoints[3].value = Math.max(580, Math.round(analytics.revenue * 0.25));
        }

        const maxVal = Math.max(...dataPoints.map(d => d.value)) * 1.15 || 1000;
        const paddingLeft = 45;
        const paddingRight = 20;
        const paddingTop = 20;
        const paddingBottom = 30;

        const chartWidth = svgWidth - paddingLeft - paddingRight;
        const chartHeight = svgHeight - paddingTop - paddingBottom;

        const pointsCoords = dataPoints.map((d, index) => {
            const x = paddingLeft + (index / (dataPoints.length - 1)) * chartWidth;
            const y = paddingTop + chartHeight - (d.value / maxVal) * chartHeight;
            return { x, y, label: d.label, val: d.value };
        });

        // Bezier cubic spline calculation
        let pathString = `M ${pointsCoords[0].x} ${pointsCoords[0].y}`;
        for (let i = 1; i < pointsCoords.length; i++) {
            const cpX1 = pointsCoords[i - 1].x + chartWidth / (dataPoints.length - 1) / 2;
            const cpY1 = pointsCoords[i - 1].y;
            const cpX2 = pointsCoords[i].x - chartWidth / (dataPoints.length - 1) / 2;
            const cpY2 = pointsCoords[i].y;
            pathString += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${pointsCoords[i].x} ${pointsCoords[i].y}`;
        }

        const areaPathString = pathString + ` L ${pointsCoords[pointsCoords.length - 1].x} ${paddingTop + chartHeight} L ${pointsCoords[0].x} ${paddingTop + chartHeight} Z`;

        // Render grid lines
        let gridLines = '';
        const gridCount = 4;
        for (let i = 0; i <= gridCount; i++) {
            const yVal = paddingTop + (i / gridCount) * chartHeight;
            const displayVal = Math.round(maxVal - (i / gridCount) * maxVal);
            gridLines += `
                <line x1="${paddingLeft}" y1="${yVal}" x2="${svgWidth - paddingRight}" y2="${yVal}" class="svg-grid-line" />
                <text x="${paddingLeft - 10}" y="${yVal + 3}" text-anchor="end" class="svg-axis-text">₹${displayVal}</text>
            `;
        }

        // Generate data dots and text tags
        let dotsHtml = '';
        let xLabels = '';
        pointsCoords.forEach((pt) => {
            dotsHtml += `
                <circle cx="${pt.x}" cy="${pt.y}" r="5.5" class="svg-chart-dot" data-val="₹${pt.val}" data-time="${pt.label}">
                    <title>₹${pt.val} at ${pt.label}</title>
                </circle>
            `;
            xLabels += `
                <text x="${pt.x}" y="${paddingTop + chartHeight + 18}" text-anchor="middle" class="svg-axis-text">${pt.label}</text>
            `;
        });

        container.innerHTML = `
            <svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" style="overflow: visible;">
                <defs>
                    <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--accent-gold)" stop-opacity="0.35" />
                        <stop offset="100%" stop-color="var(--accent-gold)" stop-opacity="0" />
                    </linearGradient>
                </defs>
                ${gridLines}
                <path d="${areaPathString}" class="svg-chart-gradient" />
                <path d="${pathString}" class="svg-chart-path" />
                ${xLabels}
                ${dotsHtml}
            </svg>
        `;
    }

    // ----------------------------------------------------
    // POINT OF SALE (POS) SYSTEM
    // ----------------------------------------------------
    function renderPOS() {
        renderPOSTables();
        renderPOSMenu();
        renderPOSCart();
    }

    function renderPOSTables() {
        const container = document.getElementById('pos-tables-list');
        if (!container) return;

        container.innerHTML = state.tables.map(table => {
            const isActive = state.posSelectedTableId === table.id ? 'active' : '';
            const statusClass = `status-${table.status.toLowerCase()}`;
            return `
                <button class="pos-table-btn ${isActive} ${statusClass}" data-id="${table.id}">
                    <span class="number">${table.number}</span>
                    <span class="capacity">Seats: ${table.capacity}</span>
                    <span class="status">${table.status}</span>
                </button>
            `;
        }).join('');

        // Bind table selections
        container.querySelectorAll('.pos-table-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tableId = parseInt(btn.getAttribute('data-id'));
                state.posSelectedTableId = tableId;
                
                // Clear local cart drafts when switching tables, or load existing active order items
                const activeOrder = state.orders.find(o => o.table_id === tableId && !o.is_paid);
                if (activeOrder) {
                    state.posActiveCart.items = activeOrder.items.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        notes: item.notes || ''
                    }));
                    state.posActiveCart.discount = activeOrder.discount || 0.0;
                } else {
                    state.posActiveCart.items = [];
                    state.posActiveCart.discount = 0.0;
                }

                renderPOS();
            });
        });
    }

    function renderPOSMenu() {
        const container = document.getElementById('pos-menu-items');
        if (!container) return;

        // Filter dishes
        const filteredMenu = state.menu.filter(dish => {
            if (!dish.available) return false;
            const matchesSearch = dish.name.toLowerCase().includes(state.posSearchQuery.toLowerCase()) || 
                                  dish.description.toLowerCase().includes(state.posSearchQuery.toLowerCase());
            const matchesCategory = state.posCategoryFilter === 'All' || dish.category === state.posCategoryFilter;
            return matchesSearch && matchesCategory;
        });

        if (filteredMenu.length === 0) {
            container.innerHTML = '<div class="loading-placeholder">No matching signature dishes found.</div>';
            return;
        }

        container.innerHTML = filteredMenu.map(dish => {
            const hasTag = dish.tags && dish.tags.length > 0;
            const tagHtml = hasTag ? `<span class="dish-tag">${dish.tags[0]}</span>` : '';
            
            // Generate icon based on category
            let categoryIcon = 'fa-utensils';
            if (dish.category === 'Drinks') categoryIcon = 'fa-wine-glass';
            else if (dish.category === 'Desserts') categoryIcon = 'fa-ice-cream';
            else if (dish.category === 'Appetizers') categoryIcon = 'fa-cookie';

            return `
                <div class="pos-dish-card" data-id="${dish.id}">
                    <div class="dish-graphics">
                        ${tagHtml}
                        <i class="fa-solid ${categoryIcon}"></i>
                    </div>
                    <div class="dish-details">
                        <span class="dish-name">${dish.name}</span>
                        <p class="dish-desc">${dish.description}</p>
                        <div class="dish-meta">
                            <span class="dish-price">₹${dish.price.toFixed(2)}</span>
                            <div class="dish-actions">
                                <i class="fa-solid fa-circle-plus"></i>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Bind dish adding to cart
        container.querySelectorAll('.pos-dish-card').forEach(card => {
            card.addEventListener('click', () => {
                if (state.posSelectedTableId === null) {
                    showNotification('Please select a dining table on the left sidebar first!', 'warning');
                    return;
                }

                // Check if table is occupied with a finalized order sent to kitchen
                const activeOrder = state.orders.find(o => o.table_id === state.posSelectedTableId && !o.is_paid);
                if (activeOrder) {
                    showNotification('Table has a live ticket in preparation. Settle checkout bill first to re-order!', 'warning');
                    return;
                }

                const dishId = card.getAttribute('data-id');
                const dish = state.menu.find(d => d.id === dishId);
                if (!dish) return;

                // Add to active cart list
                const existing = state.posActiveCart.items.find(item => item.id === dishId);
                if (existing) {
                    existing.quantity += 1;
                } else {
                    state.posActiveCart.items.push({
                        id: dish.id,
                        name: dish.name,
                        price: dish.price,
                        quantity: 1,
                        notes: ''
                    });
                }

                renderPOSCart();
            });
        });
    }

    function renderPOSCart() {
        const cartContainer = document.getElementById('cart-items-container');
        const tableNameHeader = document.getElementById('cart-selected-table');
        const subtotalEl = document.getElementById('cart-subtotal');
        const taxEl = document.getElementById('cart-tax');
        const totalEl = document.getElementById('cart-total');
        const discountInput = document.getElementById('cart-discount-input');
        
        const btnSendKitchen = document.getElementById('btn-send-to-kitchen');
        const btnCheckoutPay = document.getElementById('btn-checkout-pay');

        if (!cartContainer) return;

        if (state.posSelectedTableId === null) {
            tableNameHeader.textContent = 'Select a Table';
            cartContainer.innerHTML = `
                <div class="cart-empty-state">
                    <i class="fa-solid fa-receipt"></i>
                    <p>Select a table on the left, then click items to add to order</p>
                </div>
            `;
            subtotalEl.textContent = '₹0.00';
            taxEl.textContent = '₹0.00';
            totalEl.textContent = '₹0.00';
            discountInput.value = 0;
            discountInput.disabled = true;
            btnSendKitchen.disabled = true;
            btnCheckoutPay.disabled = true;
            return;
        }

        const table = state.tables.find(t => t.id === state.posSelectedTableId);
        tableNameHeader.textContent = table ? `${table.number} (${table.section})` : 'Active Cart';
        discountInput.disabled = false;

        const activeOrder = state.orders.find(o => o.table_id === state.posSelectedTableId && !o.is_paid);

        if (activeOrder) {
            // Cart displays items already in preparation in the kitchen
            cartContainer.innerHTML = state.posActiveCart.items.map(item => `
                <div class="cart-item-row">
                    <div class="cart-item-main">
                        <div class="cart-item-info">
                            <span class="cart-item-name">${item.name}</span>
                            <span class="cart-item-price">₹${item.price.toFixed(2)}</span>
                        </div>
                        <div class="badge badge-success" style="font-size: 0.8rem;">
                            Qty: ${item.quantity}
                        </div>
                    </div>
                    ${item.notes ? `<div style="font-size: 0.72rem; color: var(--amber-warning); font-style: italic;">Note: ${item.notes}</div>` : ''}
                </div>
            `).join('');

            // Totals from active order
            subtotalEl.textContent = `₹${activeOrder.subtotal.toFixed(2)}`;
            taxEl.textContent = `₹${activeOrder.tax.toFixed(2)}`;
            discountInput.value = activeOrder.discount;
            discountInput.disabled = true; // Block edits for pending orders
            totalEl.textContent = `₹${activeOrder.total.toFixed(2)}`;

            btnSendKitchen.disabled = true; // Sent already
            btnCheckoutPay.disabled = false; // Eligible for payment
        } else {
            // Draft cart
            if (state.posActiveCart.items.length === 0) {
                cartContainer.innerHTML = `
                    <div class="cart-empty-state">
                        <i class="fa-solid fa-cart-plus"></i>
                        <p>Cart is currently empty. Click on culinary items to build draft bill.</p>
                    </div>
                `;
                subtotalEl.textContent = '₹0.00';
                taxEl.textContent = '₹0.00';
                totalEl.textContent = '₹0.00';
                discountInput.value = 0;
                btnSendKitchen.disabled = true;
                btnCheckoutPay.disabled = true;
                return;
            }

            cartContainer.innerHTML = state.posActiveCart.items.map((item, idx) => `
                <div class="cart-item-row">
                    <div class="cart-item-main">
                        <div class="cart-item-info">
                            <span class="cart-item-name">${item.name}</span>
                            <span class="cart-item-price">₹${item.price.toFixed(2)}</span>
                        </div>
                        <div class="cart-item-qty">
                            <button class="qty-btn dec-qty" data-index="${idx}"><i class="fa-solid fa-minus"></i></button>
                            <span class="qty-val">${item.quantity}</span>
                            <button class="qty-btn inc-qty" data-index="${idx}"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                    <input type="text" class="cart-item-note-input" placeholder="Add custom recipe notes (e.g. no onions)" data-index="${idx}" value="${item.notes}">
                </div>
            `).join('');

            // Attach events
            cartContainer.querySelectorAll('.dec-qty').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.getAttribute('data-index'));
                    if (state.posActiveCart.items[idx].quantity > 1) {
                        state.posActiveCart.items[idx].quantity -= 1;
                    } else {
                        state.posActiveCart.splice(idx, 1);
                    }
                    renderPOSCart();
                });
            });

            cartContainer.querySelectorAll('.inc-qty').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.getAttribute('data-index'));
                    state.posActiveCart.items[idx].quantity += 1;
                    renderPOSCart();
                });
            });

            cartContainer.querySelectorAll('.cart-item-note-input').forEach(input => {
                input.addEventListener('input', () => {
                    const idx = parseInt(input.getAttribute('data-index'));
                    state.posActiveCart.items[idx].notes = input.value;
                });
            });

            // Calculate billing
            const subtotal = state.posActiveCart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = subtotal * 0.09;
            const discount = parseFloat(discountInput.value) || 0.0;
            const grandTotal = Math.max(0, subtotal + tax - discount);

            subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
            taxEl.textContent = `₹${tax.toFixed(2)}`;
            totalEl.textContent = `₹${grandTotal.toFixed(2)}`;

            btnSendKitchen.disabled = false;
            btnCheckoutPay.disabled = true; // Must submit order to kitchen first
        }
    }

    // ----------------------------------------------------
    // TABLE PLANNER LAYOUT
    // ----------------------------------------------------
    function renderTablePlanner() {
        renderTableGrid();
        renderTableDetailsPanel();
    }

    function renderTableGrid() {
        const container = document.getElementById('tables-floor-plan');
        if (!container) return;

        const filteredTables = state.tables.filter(table => {
            return state.plannerSectionFilter === 'All' || table.section === state.plannerSectionFilter;
        });

        container.innerHTML = filteredTables.map(table => {
            const isSelected = state.plannerSelectedTableId === table.id ? 'active-outline' : '';
            const activeOrder = state.orders.find(o => o.table_id === table.id && !o.is_paid);
            
            // Check order subtotal to determine if VIP highlight is required
            const isVipOrder = activeOrder && activeOrder.total > 150 ? 'vip-spark' : '';
            
            let statusIcon = 'fa-chair';
            if (table.status === 'Occupied') statusIcon = 'fa-user-group';
            else if (table.status === 'Reserved') statusIcon = 'fa-calendar-check';

            return `
                <div class="floor-table status-${table.status} ${isSelected} ${isVipOrder}" data-id="${table.id}">
                    <span class="tbl-badge">${table.status}</span>
                    <div class="tbl-icon"><i class="fa-solid ${statusIcon}"></i></div>
                    <span class="tbl-num">${table.number}</span>
                    <div class="tbl-meta">
                        <span>Max Capacity: ${table.capacity}</span>
                        <span>Section: ${table.section}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Bind clicks
        container.querySelectorAll('.floor-table').forEach(card => {
            card.addEventListener('click', () => {
                const tableId = parseInt(card.getAttribute('data-id'));
                state.plannerSelectedTableId = tableId;
                renderTablePlanner();
            });
        });
    }

    function renderTableDetailsPanel() {
        const body = document.getElementById('table-details-body');
        const headerName = document.getElementById('table-details-name');
        const headerStatus = document.getElementById('table-details-status');

        if (!body) return;

        if (state.plannerSelectedTableId === null) {
            headerName.textContent = 'Table Operations';
            headerStatus.textContent = 'No Selection';
            headerStatus.className = 'badge';
            body.innerHTML = `
                <div class="table-details-placeholder">
                    <i class="fa-solid fa-circle-info"></i>
                    <p>Click on any table in the floor plan grid to perform guest reservations, seat walk-ins, edit occupancy, or view existing billing statements.</p>
                </div>
            `;
            return;
        }

        const table = state.tables.find(t => t.id === state.plannerSelectedTableId);
        headerName.textContent = table.number;
        headerStatus.textContent = table.status;
        
        let statusBadgeClass = 'badge-success';
        if (table.status === 'Occupied') statusBadgeClass = 'badge-danger';
        else if (table.status === 'Reserved') statusBadgeClass = 'badge-warning';
        headerStatus.className = `badge ${statusBadgeClass}`;

        if (table.status === 'Occupied') {
            const order = state.orders.find(o => o.table_id === table.id && !o.is_paid);
            if (order) {
                body.innerHTML = `
                    <div class="detail-sec">
                        <h5>Active Dining Invoice</h5>
                        <div class="detail-data-row">
                            <span class="lbl">Order ID</span>
                            <span class="val">${order.id}</span>
                        </div>
                        <div class="detail-data-row">
                            <span class="lbl">Opened At</span>
                            <span class="val">${order.timestamp ? order.timestamp.split('T')[-1] || order.timestamp : 'Just now'}</span>
                        </div>
                    </div>
                    <div class="detail-sec">
                        <h5>Selected Gastronomy</h5>
                        <div style="max-height: 150px; overflow-y: auto; margin-bottom: 12px; background: rgba(0,0,0,0.15); border-radius: 8px; padding: 10px;">
                            ${order.items.map(item => `
                                <div class="detail-data-row" style="font-size: 0.82rem;">
                                    <span class="lbl">${item.quantity}x ${item.name}</span>
                                    <span class="val">₹${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="detail-data-row">
                            <span class="lbl">Subtotal</span>
                            <span class="val">₹${order.subtotal.toFixed(2)}</span>
                        </div>
                        <div class="detail-data-row">
                            <span class="lbl">Luxury Tax (9%)</span>
                            <span class="val">₹${order.tax.toFixed(2)}</span>
                        </div>
                        <div class="detail-data-row" style="color: var(--crimson-danger);">
                            <span class="lbl">Discount Applied</span>
                            <span class="val">-₹${order.discount.toFixed(2)}</span>
                        </div>
                        <div class="detail-data-row" style="font-weight: 700; border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 4px;">
                            <span class="lbl">Total Due</span>
                            <span class="val" style="color: var(--accent-gold);">₹${order.total.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="detail-actions">
                        <button class="btn btn-gold btn-sm" id="btn-planner-settle"><i class="fa-solid fa-credit-card"></i> Settle Checkout & Release</button>
                        <button class="btn btn-secondary btn-sm" id="btn-planner-goto-pos"><i class="fa-solid fa-cash-register"></i> Edit Order in POS</button>
                    </div>
                `;

                document.getElementById('btn-planner-settle').addEventListener('click', () => {
                    openReceiptModal(order);
                });

                document.getElementById('btn-planner-goto-pos').addEventListener('click', () => {
                    state.posSelectedTableId = table.id;
                    
                    // Load active items to POS cart
                    state.posActiveCart.items = order.items.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        notes: item.notes || ''
                    }));
                    state.posActiveCart.discount = order.discount;

                    // Switch tab to POS
                    const posNavItem = document.querySelector('.sidebar-nav .nav-item[data-tab="pos"]');
                    if (posNavItem) posNavItem.click();
                });
            } else {
                body.innerHTML = `
                    <p style="font-size: 0.88rem; color: var(--text-secondary); text-align: center; margin-bottom: 20px;">
                        This table is marked Occupied, but no ticket items have been sent to the kitchen yet.
                    </p>
                    <div class="detail-actions">
                        <button class="btn btn-gold btn-sm" id="btn-planner-order-now"><i class="fa-solid fa-utensils"></i> Order Culinary Now</button>
                        <button class="btn btn-secondary btn-sm" id="btn-planner-release-empty"><i class="fa-solid fa-rotate-left"></i> Release Table</button>
                    </div>
                `;

                document.getElementById('btn-planner-order-now').addEventListener('click', () => {
                    state.posSelectedTableId = table.id;
                    state.posActiveCart.items = [];
                    const posNavItem = document.querySelector('.sidebar-nav .nav-item[data-tab="pos"]');
                    if (posNavItem) posNavItem.click();
                });

                document.getElementById('btn-planner-release-empty').addEventListener('click', async () => {
                    await fetchAPI(`/api/tables/${table.id}`, {
                        method: 'PUT',
                        body: { status: 'Available' }
                    });
                    loadAllData();
                });
            }
        } else if (table.status === 'Reserved') {
            const reservation = state.reservations.find(r => r.table_id === table.id);
            if (reservation) {
                body.innerHTML = `
                    <div class="detail-sec">
                        <h5>Reservation Records</h5>
                        <div class="detail-data-row">
                            <span class="lbl">Guest Name</span>
                            <span class="val" style="color: var(--accent-gold);">${reservation.guest_name}</span>
                        </div>
                        <div class="detail-data-row">
                            <span class="lbl">Phone Record</span>
                            <span class="val">${reservation.phone || 'N/A'}</span>
                        </div>
                        <div class="detail-data-row">
                            <span class="lbl">Covers / Party</span>
                            <span class="val">${reservation.party_size} Guests</span>
                        </div>
                        <div class="detail-data-row">
                            <span class="lbl">Seating Time</span>
                            <span class="val"><i class="fa-regular fa-clock"></i> ${reservation.time}</span>
                        </div>
                        <div class="detail-data-row">
                            <span class="lbl">Date Booked</span>
                            <span class="val">${reservation.date}</span>
                        </div>
                    </div>
                    ${reservation.notes ? `
                        <div class="detail-sec">
                            <h5>Preferences & Allergies</h5>
                            <p style="font-size: 0.82rem; font-style: italic; background: rgba(0,0,0,0.1); border-left: 2px solid var(--accent-gold); padding: 6px 10px; border-radius: 4px;">
                                "${reservation.notes}"
                            </p>
                        </div>
                    ` : ''}
                    <div class="detail-actions">
                        <button class="btn btn-gold btn-sm" id="btn-planner-seat-res"><i class="fa-solid fa-chair"></i> Seat Guest & Open Order</button>
                        <button class="btn btn-danger btn-sm" id="btn-planner-cancel-res"><i class="fa-solid fa-trash-can"></i> Cancel Reservation</button>
                    </div>
                `;

                document.getElementById('btn-planner-seat-res').addEventListener('click', async () => {
                    // Update table status to Occupied in backend
                    await fetchAPI(`/api/tables/${table.id}`, {
                        method: 'PUT',
                        body: { status: 'Occupied' }
                    });
                    
                    // Redirect to POS with table selected
                    state.posSelectedTableId = table.id;
                    state.posActiveCart.items = [];
                    
                    // Automatically clean up reservation since guest is seated
                    await fetchAPI(`/api/reservations/${reservation.id}`, { method: 'DELETE' });

                    showNotification(`Guest ${reservation.guest_name} seated! POS taking order.`, 'success');
                    await loadAllData();
                    
                    const posNavItem = document.querySelector('.sidebar-nav .nav-item[data-tab="pos"]');
                    if (posNavItem) posNavItem.click();
                });

                document.getElementById('btn-planner-cancel-res').addEventListener('click', async () => {
                    if (confirm(`Cancel reservation for ${reservation.guest_name}?`)) {
                        await fetchAPI(`/api/reservations/${reservation.id}`, { method: 'DELETE' });
                        showNotification('Reservation cancelled successfully.', 'success');
                        loadAllData();
                    }
                });
            } else {
                body.innerHTML = `
                    <p style="font-size: 0.88rem; color: var(--text-secondary); text-align: center;">No reservation metadata linked. Recovering status...</p>
                    <button class="btn btn-secondary btn-sm" id="btn-planner-reset-res" style="margin-top: 10px; width: 100%;">Release Table</button>
                `;
                document.getElementById('btn-planner-reset-res').addEventListener('click', async () => {
                    await fetchAPI(`/api/tables/${table.id}`, {
                        method: 'PUT',
                        body: { status: 'Available' }
                    });
                    loadAllData();
                });
            }
        } else {
            // Available
            body.innerHTML = `
                <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 16px;">
                    This table is empty and available for immediate dining or advanced booking.
                </p>
                <div class="detail-actions" style="margin-bottom: 20px;">
                    <button class="btn btn-gold btn-sm" id="btn-planner-seat-walkin"><i class="fa-solid fa-user-check"></i> Seat Walk-In Diner</button>
                </div>
                
                <hr style="border: none; border-top: 1px solid var(--border-color); margin: 20px 0;">
                
                <h5>Quick Table Reservation</h5>
                <form id="form-planner-quick-res" style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="qres-name">Guest Identity</label>
                        <input type="text" id="qres-name" class="form-control" placeholder="e.g. Jean-Luc" required style="padding: 8px 12px; font-size: 0.85rem;">
                    </div>
                    <div class="form-row">
                        <div class="form-group col-6" style="margin-bottom: 0;">
                            <label for="qres-party">Covers</label>
                            <input type="number" id="qres-party" class="form-control" value="2" min="1" max="${table.capacity}" required style="padding: 8px 12px; font-size: 0.85rem;">
                        </div>
                        <div class="form-group col-6" style="margin-bottom: 0;">
                            <label for="qres-time">Time</label>
                            <input type="time" id="qres-time" class="form-control" value="19:30" required style="padding: 8px 12px; font-size: 0.85rem;">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-secondary btn-sm" style="font-size: 0.8rem; padding: 8px 14px;"><i class="fa-solid fa-calendar-plus"></i> Save Booking</button>
                </form>
            `;

            document.getElementById('btn-planner-seat-walkin').addEventListener('click', async () => {
                await fetchAPI(`/api/tables/${table.id}`, {
                    method: 'PUT',
                    body: { status: 'Occupied' }
                });
                state.posSelectedTableId = table.id;
                state.posActiveCart.items = [];
                showNotification(`Seated Walk-in at ${table.number}.`, 'success');
                await loadAllData();
                const posNavItem = document.querySelector('.sidebar-nav .nav-item[data-tab="pos"]');
                if (posNavItem) posNavItem.click();
            });

            document.getElementById('form-planner-quick-res').addEventListener('submit', async (e) => {
                e.preventDefault();
                const guestName = document.getElementById('qres-name').value;
                const partySize = parseInt(document.getElementById('qres-party').value);
                const time = document.getElementById('qres-time').value;
                const todayStr = new Date().toISOString().substring(0, 10);

                await fetchAPI('/api/reservations', {
                    method: 'POST',
                    body: {
                        guest_name: guestName,
                        party_size: partySize,
                        time: time,
                        date: todayStr,
                        table_id: table.id,
                        phone: '',
                        notes: 'Quick reservation from table planner'
                    }
                });

                showNotification(`Reservation recorded for ${guestName} at ${table.number}.`, 'success');
                loadAllData();
            });
        }
    }

    // ----------------------------------------------------
    // MENU MANAGER
    // ----------------------------------------------------
    function renderMenuManager() {
        const container = document.getElementById('menu-manager-rows');
        if (!container) return;

        const filteredMenu = state.menu.filter(dish => {
            const matchesSearch = dish.name.toLowerCase().includes(state.menuSearchQuery.toLowerCase()) || 
                                  dish.description.toLowerCase().includes(state.menuSearchQuery.toLowerCase());
            const matchesCategory = state.menuCategoryFilter === 'All' || dish.category === state.menuCategoryFilter;
            return matchesSearch && matchesCategory;
        });

        if (filteredMenu.length === 0) {
            container.innerHTML = '<tr><td colspan="7" class="loading-placeholder">No culinary formulations found.</td></tr>';
            return;
        }

        container.innerHTML = filteredMenu.map(dish => {
            const checkedAttr = dish.available ? 'checked' : '';
            const tagSpans = (dish.tags || []).map(t => `<span class="mgr-tag">${t}</span>`).join('');
            
            // Icon helper
            let catIcon = 'fa-utensils';
            if (dish.category === 'Drinks') catIcon = 'fa-wine-glass';
            else if (dish.category === 'Desserts') catIcon = 'fa-ice-cream';
            else if (dish.category === 'Appetizers') catIcon = 'fa-cookie';

            return `
                <tr data-id="${dish.id}">
                    <td>
                        <div class="mgr-dish-cell">
                            <div class="mgr-dish-graphic">
                                <i class="fa-solid ${catIcon}"></i>
                            </div>
                            <span class="mgr-dish-name">${dish.name}</span>
                        </div>
                    </td>
                    <td><span class="badge badge-warning" style="background: rgba(245, 158, 11, 0.08); color: var(--amber-warning);">${dish.category}</span></td>
                    <td><span class="mgr-dish-price">₹${dish.price.toFixed(2)}</span></td>
                    <td style="max-width: 250px; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">${dish.description}</td>
                    <td>${tagSpans}</td>
                    <td>
                        <label class="toggle-switch-container">
                            <input type="checkbox" class="menu-availability-toggle" data-id="${dish.id}" ${checkedAttr}>
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td>
                        <div class="action-btn-group">
                            <button class="action-icon-btn edit-dish-btn" data-id="${dish.id}" title="Edit Formulation"><i class="fa-solid fa-pencil"></i></button>
                            <button class="action-icon-btn delete-btn delete-dish-btn" data-id="${dish.id}" title="Delete Recipe"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind events
        container.querySelectorAll('.menu-availability-toggle').forEach(chk => {
            chk.addEventListener('change', async () => {
                const dishId = chk.getAttribute('data-id');
                const isChecked = chk.checked;
                
                await fetchAPI(`/api/menu/${dishId}`, {
                    method: 'PUT',
                    body: { available: isChecked }
                });
                showNotification(`Dish availability updated.`, 'success');
                loadAllData(true);
            });
        });

        container.querySelectorAll('.edit-dish-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const dishId = btn.getAttribute('data-id');
                const dish = state.menu.find(d => d.id === dishId);
                if (dish) {
                    openMenuModal(dish);
                }
            });
        });

        container.querySelectorAll('.delete-dish-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const dishId = btn.getAttribute('data-id');
                const dish = state.menu.find(d => d.id === dishId);
                if (confirm(`Remove ${dish.name} permanently from Bistro Menu formulation?`)) {
                    await fetchAPI(`/api/menu/${dishId}`, { method: 'DELETE' });
                    showNotification('Culinary recipe deleted.', 'success');
                    loadAllData();
                }
            });
        });
    }

    // ----------------------------------------------------
    // KITCHEN MONITOR VIEW
    // ----------------------------------------------------
    function renderKitchenView() {
        const colReceived = document.getElementById('kcards-received');
        const colPreparing = document.getElementById('kcards-preparing');
        const colReady = document.getElementById('kcards-ready');

        const cntReceived = document.getElementById('kcount-received');
        const cntPreparing = document.getElementById('kcount-preparing');
        const cntReady = document.getElementById('kcount-ready');

        if (!colReceived || !colPreparing || !colReady) return;

        // Reset columns HTML
        colReceived.innerHTML = '';
        colPreparing.innerHTML = '';
        colReady.innerHTML = '';

        let counts = { Received: 0, Preparing: 0, 'Ready to Serve': 0 };

        // Process only unpaid orders or orders with active cooking states
        const activeOrders = state.orders.filter(o => !o.is_paid && ['Received', 'Preparing', 'Ready to Serve'].includes(o.status));

        activeOrders.forEach(order => {
            counts[order.status] = (counts[order.status] || 0) + 1;
            const table = state.tables.find(t => t.id === order.table_id);
            const tableName = table ? table.number : `Table ${order.table_id}`;
            const timeStr = order.timestamp ? order.timestamp.split('T')[1] || order.timestamp : 'Just now';

            const card = document.createElement('div');
            card.className = 'kitchen-order-card';
            card.innerHTML = `
                <div class="kcard-head">
                    <span class="kcard-table">${tableName}</span>
                    <span class="kcard-time"><i class="fa-regular fa-clock"></i> ${timeStr.substring(0,5)}</span>
                </div>
                <div class="kcard-items-list">
                    ${order.items.map(item => `
                        <div class="kcard-item-row">
                            <span class="kcard-item-qty">${item.quantity}x</span>
                            <span class="kcard-item-name">${item.name}</span>
                        </div>
                        ${item.notes ? `<span class="kcard-item-notes"><i class="fa-solid fa-pencil" style="font-size: 0.65rem;"></i> "${item.notes}"</span>` : ''}
                    `).join('')}
                </div>
                <div class="kcard-actions">
                    ${getActionBtnForKitchenStatus(order.id, order.status)}
                </div>
            `;

            if (order.status === 'Received') {
                colReceived.appendChild(card);
            } else if (order.status === 'Preparing') {
                colPreparing.appendChild(card);
            } else if (order.status === 'Ready to Serve') {
                colReady.appendChild(card);
            }
        });

        // Set counts
        cntReceived.textContent = counts.Received;
        cntPreparing.textContent = counts.Preparing;
        cntReady.textContent = counts['Ready to Serve'];

        // Bind ticket action buttons
        document.querySelectorAll('.btn-kitchen-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const orderId = btn.getAttribute('data-order-id');
                const nextStatus = btn.getAttribute('data-next-status');
                
                await fetchAPI(`/api/orders/${orderId}/status`, {
                    method: 'PUT',
                    body: { status: nextStatus }
                });
                showNotification(`Ticket updated to: ${nextStatus}`, 'success');
                loadAllData();
            });
        });

        // Render Kitchen Stock Control Checklist
        const stockContainer = document.getElementById('kitchen-inventory-stock');
        if (stockContainer) {
            stockContainer.innerHTML = state.menu.map(dish => {
                const checkedAttr = dish.available ? 'checked' : '';
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-primary); padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                        <div style="display: flex; flex-direction: column; gap: 2px; max-width: 70%;">
                            <span style="font-size: 0.85rem; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${dish.name}</span>
                            <span style="font-size: 0.72rem; color: var(--text-secondary);">${dish.category}</span>
                        </div>
                        <label class="toggle-switch-container">
                            <input type="checkbox" class="kitchen-stock-toggle" data-id="${dish.id}" ${checkedAttr}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `;
            }).join('');

            // Bind toggle change events
            stockContainer.querySelectorAll('.kitchen-stock-toggle').forEach(toggle => {
                toggle.addEventListener('change', async () => {
                    const dishId = toggle.getAttribute('data-id');
                    const isChecked = toggle.checked;
                    await fetchAPI(`/api/menu/${dishId}`, {
                        method: 'PUT',
                        body: { available: isChecked }
                    });
                    showNotification(`Stock state updated for ${state.menu.find(d => d.id === dishId).name}`, 'success');
                    loadAllData(true);
                });
            });
        }
    }

    // ----------------------------------------------------
    // STAFF MANAGER PANEL
    // ----------------------------------------------------
    function renderStaff() {
        const container = document.getElementById('staff-rows');
        if (!container) return;

        const filteredStaff = state.staff.filter(st => {
            const matchesSearch = st.name.toLowerCase().includes(state.staffSearchQuery.toLowerCase()) || 
                                  st.role.toLowerCase().includes(state.staffSearchQuery.toLowerCase());
            const matchesRole = state.staffRoleFilter === 'All' || st.role === state.staffRoleFilter;
            return matchesSearch && matchesRole;
        });

        if (filteredStaff.length === 0) {
            container.innerHTML = '<tr><td colspan="5" class="loading-placeholder">No staff profiles registered.</td></tr>';
            return;
        }

        container.innerHTML = filteredStaff.map(st => {
            let statusBadge = 'badge-success';
            if (st.status === 'On Break') statusBadge = 'badge-warning';
            else if (st.status === 'Off Duty') statusBadge = 'badge-danger';

            return `
                <tr data-id="${st.id}">
                    <td>
                        <div class="mgr-dish-cell">
                            <div class="avatar" style="width: 32px; height: 32px; font-size: 0.9rem;"><i class="fa-solid fa-user"></i></div>
                            <span class="mgr-dish-name" style="margin-left: 8px;">${st.name}</span>
                        </div>
                    </td>
                    <td><span class="badge badge-warning" style="background: rgba(209, 161, 83, 0.08); color: var(--accent-gold);">${st.role}</span></td>
                    <td><span style="font-size: 0.85rem; color: var(--text-secondary);">${st.shift}</span></td>
                    <td><span class="badge ${statusBadge}">${st.status}</span></td>
                    <td>
                        <div class="action-btn-group">
                            <button class="action-icon-btn edit-staff-btn" data-id="${st.id}" title="Edit Profile"><i class="fa-solid fa-pencil"></i></button>
                            <button class="action-icon-btn delete-btn delete-staff-btn" data-id="${st.id}" title="Delete Staff Profile"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind Edit buttons
        container.querySelectorAll('.edit-staff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const staffId = btn.getAttribute('data-id');
                const st = state.staff.find(x => x.id === staffId);
                if (st) {
                    openStaffModal(st);
                }
            });
        });

        // Bind Delete buttons
        container.querySelectorAll('.delete-staff-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const staffId = btn.getAttribute('data-id');
                const st = state.staff.find(x => x.id === staffId);
                if (confirm(`De-register staff member ${st.name} from database?`)) {
                    await fetchAPI(`/api/staff/${staffId}`, { method: 'DELETE' });
                    showNotification('Staff profile de-registered.', 'success');
                    loadAllData();
                }
            });
        });
    }

    function openStaffModal(st) {
        document.getElementById('staff-modal-title').textContent = 'Modify Staff Formulation';
        document.getElementById('staff-member-id').value = st.id;
        document.getElementById('staff-name').value = st.name;
        document.getElementById('staff-role').value = st.role;
        document.getElementById('staff-shift').value = st.shift;
        document.getElementById('staff-status').value = st.status;
        document.getElementById('btn-save-staff-item').textContent = 'Confirm Changes';
        document.getElementById('modal-staff').classList.add('active');
    }

    function getActionBtnForKitchenStatus(orderId, status) {
        if (status === 'Received') {
            return `<button class="btn btn-gold btn-sm btn-kitchen-action" data-order-id="${orderId}" data-next-status="Preparing"><i class="fa-solid fa-fire"></i> Start Cooking</button>`;
        }
        if (status === 'Preparing') {
            return `<button class="btn btn-gold btn-sm btn-kitchen-action" data-order-id="${orderId}" data-next-status="Ready to Serve"><i class="fa-solid fa-bell"></i> Ready to Serve</button>`;
        }
        if (status === 'Ready to Serve') {
            return `<button class="btn btn-secondary btn-sm btn-kitchen-action" data-order-id="${orderId}" data-next-status="Served"><i class="fa-solid fa-circle-check"></i> Served / Complete</button>`;
        }
        return '';
    }

    // ----------------------------------------------------
    // GLOBAL POPUP MODALS MANAGEMENT
    // ----------------------------------------------------

    // Reservation Modal Handler
    const modalRes = document.getElementById('modal-reservation');
    const formRes = document.getElementById('form-reservation');
    const btnNewResHeader = document.getElementById('btn-quick-reservation');

    if (btnNewResHeader && modalRes) {
        btnNewResHeader.addEventListener('click', () => {
            document.getElementById('res-modal-title').textContent = 'Premium Table Reservation';
            document.getElementById('res-table-id').value = '';
            formRes.reset();

            // Populate table selector dropdown with available tables
            const dropdown = document.getElementById('res-table-selector');
            if (dropdown) {
                const availableTables = state.tables.filter(t => t.status === 'Available');
                if (availableTables.length > 0) {
                    dropdown.innerHTML = availableTables.map(t => `
                        <option value="${t.id}">${t.number} (${t.section}, Seats ${t.capacity})</option>
                    `).join('');
                    document.getElementById('res-table-select-group').style.display = 'block';
                } else {
                    dropdown.innerHTML = '<option value="">No Available Tables</option>';
                    document.getElementById('res-table-select-group').style.display = 'none';
                    showNotification('No dining tables are currently Available for direct reservation.', 'warning');
                }
            }

            // Default date to today
            document.getElementById('res-date').value = new Date().toISOString().substring(0, 10);
            modalRes.classList.add('active');
        });
    }

    // Close buttons for modals
    document.querySelectorAll('.btn-close-modal, .btn-cancel-res-modal, #btn-cancel-res-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        });
    });

    if (formRes) {
        formRes.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const guestName = document.getElementById('res-guest-name').value;
            const phone = document.getElementById('res-phone').value;
            const partySize = parseInt(document.getElementById('res-party-size').value);
            const date = document.getElementById('res-date').value;
            const time = document.getElementById('res-time').value;
            const tableIdInput = document.getElementById('res-table-id').value;
            const notes = document.getElementById('res-notes').value;

            let tableId = tableIdInput ? parseInt(tableIdInput) : parseInt(document.getElementById('res-table-selector').value);
            if (!tableId) {
                showNotification('Please assign a table to proceed.', 'danger');
                return;
            }

            await fetchAPI('/api/reservations', {
                method: 'POST',
                body: {
                    guest_name: guestName,
                    phone: phone,
                    party_size: partySize,
                    date: date,
                    time: time,
                    table_id: tableId,
                    notes: notes
                }
            });

            showNotification(`Exquisite booking reserved for ${guestName}.`, 'success');
            modalRes.classList.remove('active');
            loadAllData();
        });
    }

    // Menu Item Modal Handler
    const modalMenu = document.getElementById('modal-menu-item');
    const formMenu = document.getElementById('form-menu-item');
    const btnAddDish = document.getElementById('btn-add-menu-item');

    if (btnAddDish && modalMenu) {
        btnAddDish.addEventListener('click', () => {
            document.getElementById('menu-modal-title').textContent = 'Exquisite Culinary Formulation';
            document.getElementById('menu-item-id').value = '';
            document.getElementById('btn-save-menu-item').textContent = 'Integrate Dish';
            formMenu.reset();
            modalMenu.classList.add('active');
        });
    }

    document.querySelectorAll('#btn-cancel-menu-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            modalMenu.classList.remove('active');
        });
    });

    if (formMenu) {
        formMenu.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const dishId = document.getElementById('menu-item-id').value;
            const name = document.getElementById('menu-item-name').value;
            const price = parseFloat(document.getElementById('menu-item-price').value);
            const category = document.getElementById('menu-item-category').value;
            const desc = document.getElementById('menu-item-desc').value;
            const available = document.getElementById('menu-item-available').checked;
            
            const tagsInput = document.getElementById('menu-item-tags').value;
            const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];

            const payload = {
                name,
                price,
                category,
                description: desc,
                available,
                tags
            };

            if (dishId) {
                // PUT update
                await fetchAPI(`/api/menu/${dishId}`, {
                    method: 'PUT',
                    body: payload
                });
                showNotification('Bistro menu formulation modified.', 'success');
            } else {
                // POST create
                await fetchAPI('/api/menu', {
                    method: 'POST',
                    body: payload
                });
                showNotification('Exquisite recipe integrated successfully.', 'success');
            }

            modalMenu.classList.remove('active');
            loadAllData();
        });
    }

    function openMenuModal(dish) {
        document.getElementById('menu-modal-title').textContent = 'Modify Gastronomic Formulation';
        document.getElementById('menu-item-id').value = dish.id;
        document.getElementById('menu-item-name').value = dish.name;
        document.getElementById('menu-item-price').value = dish.price;
        document.getElementById('menu-item-category').value = dish.category;
        document.getElementById('menu-item-desc').value = dish.description;
        document.getElementById('menu-item-available').checked = dish.available;
        document.getElementById('menu-item-tags').value = (dish.tags || []).join(', ');
        
        document.getElementById('btn-save-menu-item').textContent = 'Confirm Changes';
        modalMenu.classList.add('active');
    }

    // Receipt Invoice Modal Handler
    const modalReceipt = document.getElementById('modal-receipt');
    
    function openReceiptModal(order) {
        const paper = document.getElementById('receipt-paper-content');
        if (!paper || !modalReceipt) return;

        const table = state.tables.find(t => t.id === order.table_id);
        const tableName = table ? table.number : `Table ${order.table_id}`;
        
        const timestamp = order.timestamp || new Date().toISOString();
        const dateStr = timestamp.substring(0, 10);
        const timeStr = timestamp.substring(11, 16);

        paper.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="font-family: 'Playfair Display', serif; font-weight: 700; margin-bottom: 4px;">Shahi Darbar</h3>
                <p style="font-size: 0.72rem; letter-spacing: 2px; color: #555; margin-bottom: 8px;">AUTHENTIC INDIAN</p>
                <div style="border-top: 1px dashed #bbb; border-bottom: 1px dashed #bbb; padding: 4px 0; font-size: 0.78rem;">
                    Bistro Invoice: ${order.id}<br>
                    Date: ${dateStr} | Time: ${timeStr}
                </div>
            </div>
            
            <div style="font-size: 0.8rem; margin-bottom: 15px;">
                Dining Location: ${tableName}<br>
                Service Server: admin (Manager)
            </div>

            <div style="border-bottom: 1px dashed #bbb; padding-bottom: 10px; margin-bottom: 15px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid #ddd;">
                            <th style="text-align: left; padding: 4px 0;">Item Description</th>
                            <th style="text-align: right; padding: 4px 0;">Qty</th>
                            <th style="text-align: right; padding: 4px 0;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map(item => `
                            <tr>
                                <td style="padding: 4px 0; max-width: 180px;">${item.name}</td>
                                <td style="text-align: right; padding: 4px 0;">${item.quantity}</td>
                                <td style="text-align: right; padding: 4px 0;">₹${(item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                            ${item.notes ? `<tr><td colspan="3" style="font-size: 0.7rem; color: #777; font-style: italic; padding-bottom: 6px;">* Note: "${item.notes}"</td></tr>` : ''}
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="font-size: 0.82rem; display: flex; flex-direction: column; gap: 4px; border-bottom: 1px dashed #bbb; padding-bottom: 10px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Subtotal:</span>
                    <span>₹${order.subtotal.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Service Tax (9.0%):</span>
                    <span>₹${order.tax.toFixed(2)}</span>
                </div>
                ${order.discount > 0 ? `
                <div style="display: flex; justify-content: space-between; color: #b33;">
                    <span>Discount Applied:</span>
                    <span>-₹${order.discount.toFixed(2)}</span>
                </div>
                ` : ''}
            </div>

            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1.05rem; margin-bottom: 25px;">
                <span>Total Due:</span>
                <span>₹${order.total.toFixed(2)}</span>
            </div>

            <div style="text-align: center; font-size: 0.72rem; color: #555;">
                <p>Dhanyavaad for your visit!</p>
                <p>Enjoyed your Traditional Experience?</p>
                <p style="margin-top: 5px; font-weight: 600;">Shahi Darbar Restaurant Group</p>
            </div>
        `;

        // Settle payment action mapping
        const settleBtn = document.getElementById('btn-settle-receipt-pay');
        if (settleBtn) {
            // Replace click listener cleanly
            const newBtn = settleBtn.cloneNode(true);
            settleBtn.parentNode.replaceChild(newBtn, settleBtn);
            
            newBtn.addEventListener('click', async () => {
                await fetchAPI(`/api/orders/${order.id}/pay`, { method: 'POST' });
                showNotification(`Order ${order.id} Settle-Paid successfully! Table released.`, 'success');
                modalReceipt.classList.remove('active');
                
                // Reset active states if we were on the table that just got paid
                if (state.posSelectedTableId === order.table_id) {
                    state.posSelectedTableId = null;
                    state.posActiveCart.items = [];
                }
                if (state.plannerSelectedTableId === order.table_id) {
                    state.plannerSelectedTableId = null;
                }

                loadAllData();
            });
        }

        modalReceipt.classList.add('active');
    }

    // ----------------------------------------------------
    // EVENT LISTENERS CONFIG
    // ----------------------------------------------------
    function setupGlobalEventListeners() {
        // A. POS View Listeners
        const posSearch = document.getElementById('pos-menu-search');
        if (posSearch) {
            posSearch.addEventListener('input', (e) => {
                state.posSearchQuery = e.target.value;
                renderPOSMenu();
            });
        }

        const categoryFilters = document.querySelectorAll('#pos-category-filters .category-btn');
        categoryFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                categoryFilters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.posCategoryFilter = btn.getAttribute('data-category');
                renderPOSMenu();
            });
        });

        const posDiscount = document.getElementById('cart-discount-input');
        if (posDiscount) {
            posDiscount.addEventListener('input', (e) => {
                state.posActiveCart.discount = parseFloat(e.target.value) || 0.0;
                
                // Recalculate totals on the fly
                const subtotal = state.posActiveCart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const tax = subtotal * 0.09;
                const grandTotal = Math.max(0, subtotal + tax - state.posActiveCart.discount);
                document.getElementById('cart-total').textContent = `₹${grandTotal.toFixed(2)}`;
            });
        }

        const btnClearCart = document.getElementById('btn-clear-cart');
        if (btnClearCart) {
            btnClearCart.addEventListener('click', () => {
                state.posActiveCart.items = [];
                state.posActiveCart.discount = 0.0;
                renderPOSCart();
            });
        }

        const btnSendKitchen = document.getElementById('btn-send-to-kitchen');
        if (btnSendKitchen) {
            btnSendKitchen.addEventListener('click', async () => {
                if (state.posSelectedTableId === null || state.posActiveCart.items.length === 0) return;
                
                await fetchAPI('/api/orders', {
                    method: 'POST',
                    body: {
                        table_id: state.posSelectedTableId,
                        items: state.posActiveCart.items,
                        discount: state.posActiveCart.discount
                    }
                });

                showNotification('Dining Ticket dispatched successfully to Kitchen Monitor.', 'success');
                state.posActiveCart.items = [];
                state.posActiveCart.discount = 0.0;
                loadAllData();
            });
        }

        const btnCheckoutPay = document.getElementById('btn-checkout-pay');
        if (btnCheckoutPay) {
            btnCheckoutPay.addEventListener('click', () => {
                if (state.posSelectedTableId === null) return;
                const activeOrder = state.orders.find(o => o.table_id === state.posSelectedTableId && !o.is_paid);
                if (activeOrder) {
                    openReceiptModal(activeOrder);
                }
            });
        }

        // B. Table Planner View Listeners
        const sectionFilters = document.querySelectorAll('#table-section-filters .sec-filter-btn');
        sectionFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                sectionFilters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.plannerSectionFilter = btn.getAttribute('data-section');
                renderTablePlanner();
            });
        });

        // C. Menu Manager View Listeners
        const menuSearch = document.getElementById('menu-mgr-search');
        if (menuSearch) {
            menuSearch.addEventListener('input', (e) => {
                state.menuSearchQuery = e.target.value;
                renderMenuManager();
            });
        }

        const menuCategorySelect = document.getElementById('menu-mgr-category-filter');
        if (menuCategorySelect) {
            menuCategorySelect.addEventListener('change', (e) => {
                state.menuCategoryFilter = e.target.value;
                renderMenuManager();
            });
        }

        // Close Receipt modal
        const btnCloseReceipt = document.getElementById('btn-close-receipt-modal');
        if (btnCloseReceipt) {
            btnCloseReceipt.addEventListener('click', () => {
                modalReceipt.classList.remove('active');
            });
        }

        const btnPrintReceipt = document.getElementById('btn-print-receipt');
        if (btnPrintReceipt) {
            btnPrintReceipt.addEventListener('click', () => {
                alert('Contacting Restaurant POS Printing Grid...\nInvoicing ticket sent to server print pool.');
            });
        }

        // D. Staff View Listeners
        const staffSearch = document.getElementById('staff-search');
        if (staffSearch) {
            staffSearch.addEventListener('input', (e) => {
                state.staffSearchQuery = e.target.value;
                renderStaff();
            });
        }

        const staffRoleFilter = document.getElementById('staff-role-filter');
        if (staffRoleFilter) {
            staffRoleFilter.addEventListener('change', (e) => {
                state.staffRoleFilter = e.target.value;
                renderStaff();
            });
        }

        const btnAddStaff = document.getElementById('btn-add-staff');
        const modalStaff = document.getElementById('modal-staff');
        const formStaff = document.getElementById('form-staff');

        if (btnAddStaff && modalStaff) {
            btnAddStaff.addEventListener('click', () => {
                document.getElementById('staff-modal-title').textContent = 'Staff Profile Formulation';
                document.getElementById('staff-member-id').value = '';
                document.getElementById('btn-save-staff-item').textContent = 'Register Staff';
                formStaff.reset();
                modalStaff.classList.add('active');
            });
        }

        // Close/Cancel modal button events
        document.querySelectorAll('#btn-close-staff-modal, #btn-cancel-staff-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                modalStaff.classList.remove('active');
            });
        });

        if (formStaff) {
            formStaff.addEventListener('submit', async (e) => {
                e.preventDefault();
                const staffId = document.getElementById('staff-member-id').value;
                const name = document.getElementById('staff-name').value;
                const role = document.getElementById('staff-role').value;
                const shift = document.getElementById('staff-shift').value;
                const status = document.getElementById('staff-status').value;

                const payload = { name, role, shift, status };

                if (staffId) {
                    await fetchAPI(`/api/staff/${staffId}`, {
                        method: 'PUT',
                        body: payload
                    });
                    showNotification('Staff profile modified.', 'success');
                } else {
                    await fetchAPI('/api/staff', {
                        method: 'POST',
                        body: payload
                    });
                    showNotification('New staff profile registered.', 'success');
                }
                modalStaff.classList.remove('active');
                loadAllData();
            });
        }
    }

    // Initialize application logic
    init();
});
