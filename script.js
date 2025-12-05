// ============================================
// GESTION DES DONNÉES
// ============================================

const Storage = {
    getDecks() {
        const data = localStorage.getItem('flashcards_decks');
        return data ? JSON.parse(data) : [];
    },
    
    saveDecks(decks) {
        localStorage.setItem('flashcards_decks', JSON.stringify(decks));
    },
    
    getDeck(id) {
        const decks = this.getDecks();
        return decks.find(d => d.id === id);
    },
    
    saveDeck(deck) {
        const decks = this.getDecks();
        const index = decks.findIndex(d => d.id === deck.id);
        if (index >= 0) {
            decks[index] = deck;
        } else {
            decks.push(deck);
        }
        this.saveDecks(decks);
    },
    
    deleteDeck(id) {
        const decks = this.getDecks();
        const filtered = decks.filter(d => d.id !== id);
        this.saveDecks(filtered);
    }
};

// ============================================
// ALGORITHME SM-2 SIMPLIFIÉ
// ============================================

const SM2 = {
    calculateNextReview(card, quality) {
        const now = Date.now();
        
        if (!card.easeFactor) {
            card.easeFactor = 2.5;
        }
        if (!card.interval) {
            card.interval = 1;
        }
        if (!card.repetitions) {
            card.repetitions = 0;
        }
        if (!card.againCount) {
            card.againCount = 0;
        }
        if (!card.cardScore) {
            card.cardScore = 0; // Score de la carte (plus bas = plus difficile = prioritaire)
        }
        
        if (quality === 0) {
            // Encore - diminuer le score (carte plus difficile)
            card.againCount = (card.againCount || 0) + 1;
            card.cardScore = Math.max(0, (card.cardScore || 0) - 10); // Diminuer le score
            card.interval = 1;
            card.repetitions = 0;
        } else {
            // Bien ou Facile - augmenter le score selon la qualité
            if (quality === 1) {
                // Bien - ajouter +5
                card.cardScore = (card.cardScore || 0) + 5;
                card.easeFactor = Math.max(1.3, card.easeFactor - 0.15);
            } else {
                // Facile - ajouter +20
                card.cardScore = (card.cardScore || 0) + 20;
                card.easeFactor = Math.max(1.3, card.easeFactor + 0.15);
            }
            
            card.repetitions += 1;
            
            if (card.repetitions === 1) {
                card.interval = 1;
            } else if (card.repetitions === 2) {
                card.interval = 6;
            } else {
                card.interval = Math.round(card.interval * card.easeFactor);
            }
        }
        
        const daysToAdd = card.interval;
        card.nextReview = now + (daysToAdd * 24 * 60 * 60 * 1000);
        card.lastReview = now;
        
        return card;
    },
    
    getCardsToReview(deck, limit = null) {
        // Retourner les cartes triées par priorité, limitées au nombre demandé
        // Priorité : cartes avec le score le plus bas en premier (plus difficiles)
        const now = Date.now();
        
        // Filtrer et trier les cartes par score (croissant = les plus difficiles en premier)
        const cardsWithScore = deck.cards
            .filter(card => {
                return true;
            })
            .map(card => {
                const cardScore = card.cardScore || 0;
                const againCount = card.againCount || 0;
                const isDue = !card.nextReview || card.nextReview <= now;
                const daysSinceLastReview = card.lastReview 
                    ? Math.floor((now - card.lastReview) / (24 * 60 * 60 * 1000))
                    : 999;
                
                // Score final pour le tri : le score de la carte (plus bas = plus prioritaire)
                // Ajuster légèrement selon si la carte est due
                const finalScore = cardScore - (isDue ? 5 : 0) + Math.min(daysSinceLastReview, 30);
                
                return {
                    card: card,
                    score: finalScore,
                    cardScore: cardScore,
                    isDue: isDue,
                    againCount: againCount
                };
            });
        
        // Trier par score croissant (les cartes avec le score le plus bas sont les plus difficiles)
        cardsWithScore.sort((a, b) => {
            if (a.score !== b.score) {
                return a.score - b.score; // Tri croissant
            }
            // En cas d'égalité, privilégier les cartes à réviser
            if (a.isDue !== b.isDue) {
                return a.isDue ? -1 : 1;
            }
            // Puis par nombre de clics "Encore" (décroissant)
            if (b.againCount !== a.againCount) {
                return b.againCount - a.againCount;
            }
            // Enfin, par date de prochaine révision (croissante)
            const aDate = a.card.nextReview || 0;
            const bDate = b.card.nextReview || 0;
            return aDate - bDate;
        });
        
        // Limiter le nombre de cartes si demandé
        const result = cardsWithScore.map(item => item.card);
        return limit ? result.slice(0, limit) : result;
    }
};

// ============================================
// SYSTÈME DE ZONES DE COULEURS
// ============================================

const ColorZones = {
    // Détermine la couleur d'une carte en fonction de son score
    getCardColor(cardScore) {
        // Zones basées sur le score :
        // Rouge (0-9) : Très difficile
        // Orange (10-19) : Difficile
        // Jaune (20-29) : Moyen
        // Vert (30+) : Facile
        
        if (cardScore < 10) {
            return '#F44336'; // Rouge
        } else if (cardScore < 20) {
            return '#FF9800'; // Orange
        } else if (cardScore < 30) {
            return '#FFC107'; // Jaune
        } else {
            return '#4CAF50'; // Vert
        }
    },
    
    // Retourne le nom de la zone
    getZoneName(cardScore) {
        if (cardScore < 10) {
            return 'Très difficile';
        } else if (cardScore < 20) {
            return 'Difficile';
        } else if (cardScore < 30) {
            return 'Moyen';
        } else {
            return 'Facile';
        }
    }
};

// ============================================
// GESTION DE L'INTERFACE
// ============================================

const App = {
    currentDeckId: null,
    currentView: 'decks',
    isGridView: true,
    reviewCards: [],
    currentReviewIndex: 0,
    isRevealed: false,
    cardsPerSession: 10, // Nombre de cartes par session de révision
    
    init() {
        // Charger la configuration du nombre de cartes par session
        const savedCardsPerSession = localStorage.getItem('flashcards_cardsPerSession');
        if (savedCardsPerSession) {
            this.cardsPerSession = parseInt(savedCardsPerSession) || 10;
        }
        
        this.setupEventListeners();
        this.renderDecks();
        this.registerServiceWorker();
    },
    
    setupEventListeners() {
        // Navigation
        document.getElementById('add-deck-btn').addEventListener('click', () => this.showAddDeckModal());
        document.getElementById('back-btn').addEventListener('click', () => this.showDecksView());
        document.getElementById('review-back-btn').addEventListener('click', () => this.showDeckDetailView());
        
        // Menu hamburger
        document.getElementById('hamburger-menu-btn').addEventListener('click', () => this.showHamburgerMenu('decks'));
        document.getElementById('hamburger-menu-btn-detail').addEventListener('click', () => this.showHamburgerMenu('deck-detail'));
        document.getElementById('hamburger-close-btn').addEventListener('click', () => this.hideHamburgerMenu());
        document.getElementById('hamburger-menu').addEventListener('click', (e) => {
            if (e.target.id === 'hamburger-menu' || e.target.classList.contains('hamburger-menu-overlay')) {
                this.hideHamburgerMenu();
            }
        });
        
        // Import
        document.getElementById('import-file-input').addEventListener('change', (e) => this.importDeck(e));
        
        // Card actions
        document.getElementById('add-card-btn').addEventListener('click', () => this.showAddCardModal());
        
        // Review
        document.getElementById('review-card').addEventListener('click', () => this.revealAnswer());
        document.getElementById('again-btn').addEventListener('click', () => this.rateCard(0));
        document.getElementById('good-btn').addEventListener('click', () => this.rateCard(1));
        document.getElementById('easy-btn').addEventListener('click', () => this.rateCard(2));
        
        // Modal
        document.querySelector('.modal-close').addEventListener('click', () => this.hideModal());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                this.hideModal();
            }
        });
    },
    
    // ============================================
    // NAVIGATION
    // ============================================
    
    showView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${viewName}-view`).classList.add('active');
        this.currentView = viewName;
    },
    
    showDecksView() {
        this.showView('decks');
        this.currentDeckId = null;
        this.renderDecks();
    },
    
    showDeckDetailView() {
        if (!this.currentDeckId) return;
        this.showView('deck-detail');
        this.renderCards();
    },
    
    showReviewView() {
        if (!this.currentDeckId) return;
        const deck = Storage.getDeck(this.currentDeckId);
        if (!deck) return;
        
        // Limiter le nombre de cartes selon la configuration
        this.reviewCards = SM2.getCardsToReview(deck, this.cardsPerSession);
        if (this.reviewCards.length === 0) {
            alert('Aucune carte dans ce deck !');
            return;
        }
        
        this.currentReviewIndex = 0;
        this.isRevealed = false;
        this.showView('review');
        
        // Attendre que la vue soit complètement affichée avant de rendre la carte
        setTimeout(() => {
            this.renderReviewCard();
        }, 10);
    },
    
    toggleView() {
        this.isGridView = !this.isGridView;
        const container = document.getElementById('decks-container');
        
        if (this.isGridView) {
            container.classList.remove('list-view');
        } else {
            container.classList.add('list-view');
        }
        this.hideHamburgerMenu();
    },
    
    showHamburgerMenu(viewType) {
        const menu = document.getElementById('hamburger-menu');
        const menuItems = document.getElementById('hamburger-menu-items');
        
        if (!menu || !menuItems) return;
        
        let items = [];
        
        if (viewType === 'decks') {
            items = [
                { icon: '⬇', text: 'Importer un deck', action: () => {
                    document.getElementById('import-file-input').click();
                    this.hideHamburgerMenu();
                }},
                { icon: '☰', text: this.isGridView ? 'Vue liste' : 'Vue grille', action: () => {
                    this.toggleView();
                }},
            ];
        } else if (viewType === 'deck-detail') {
            items = [
                { icon: '🔄', text: 'Réviser', action: () => {
                    this.startReview(this.currentDeckId);
                    this.hideHamburgerMenu();
                }},
                { icon: '⚙', text: 'Paramètres de révision', action: () => {
                    this.showReviewSettingsModal();
                    this.hideHamburgerMenu();
                }},
                { icon: '📊', text: 'Statistiques', action: () => {
                    this.showStatsModal();
                    this.hideHamburgerMenu();
                }},
                { icon: '⬆', text: 'Exporter', action: () => {
                    this.exportDeck();
                    this.hideHamburgerMenu();
                }},
                { icon: '✎', text: 'Modifier le deck', action: () => {
                    this.showEditDeckModal();
                    this.hideHamburgerMenu();
                }},
            ];
        }
        
        menuItems.innerHTML = items.map(item => `
            <button class="hamburger-menu-item" onclick="App.hamburgerMenuAction(${items.indexOf(item)})">
                <span class="hamburger-menu-item-icon">${item.icon}</span>
                <span>${item.text}</span>
            </button>
        `).join('');
        
        // Stocker les actions pour pouvoir les appeler
        this.currentMenuActions = items.map(item => item.action);
        
        menu.classList.remove('hidden');
    },
    
    hideHamburgerMenu() {
        const menu = document.getElementById('hamburger-menu');
        if (menu) {
            menu.classList.add('hidden');
        }
    },
    
    hamburgerMenuAction(index) {
        if (this.currentMenuActions && this.currentMenuActions[index]) {
            this.currentMenuActions[index]();
        }
    },
    
    // ============================================
    // RENDU DES DECKS
    // ============================================
    
    renderDecks() {
        const decks = Storage.getDecks();
        const container = document.getElementById('decks-container');
        
        if (decks.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">📚</div>
                    <div class="empty-state-text">Aucun deck. Créez-en un pour commencer !</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = decks.map(deck => {
            const now = Date.now();
            const cardsDue = deck.cards.filter(card => !card.nextReview || card.nextReview <= now).length;
            const totalCards = deck.cards.length;
            
            return `
                <div class="deck-card" data-deck-id="${deck.id}">
                    <div class="deck-actions">
                        <button class="deck-action-btn" onclick="App.deleteDeck('${deck.id}')" title="Supprimer">🗑</button>
                        <button class="deck-action-btn" onclick="App.startReview('${deck.id}')" title="Réviser">🔄</button>
                    </div>
                    <h3>${this.escapeHtml(deck.name)}</h3>
                    <div class="deck-info">
                        <span>${totalCards} carte${totalCards > 1 ? 's' : ''}</span>
                        ${cardsDue > 0 ? `<span style="color: var(--primary-color); font-weight: 600;">${cardsDue} à réviser</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.deck-card').forEach(card => {
            const deckId = card.dataset.deckId;
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.deck-actions')) {
                    this.openDeck(deckId);
                }
            });
        });
    },
    
    openDeck(deckId) {
        this.currentDeckId = deckId;
        const deck = Storage.getDeck(deckId);
        if (deck) {
            document.getElementById('deck-title').textContent = deck.name;
            this.showDeckDetailView();
        }
    },
    
    startReview(deckId) {
        this.currentDeckId = deckId;
        this.showReviewView();
    },
    
    // ============================================
    // RENDU DES CARTES
    // ============================================
    
    renderCards() {
        if (!this.currentDeckId) return;
        
        const deck = Storage.getDeck(this.currentDeckId);
        if (!deck) return;
        
        const container = document.getElementById('cards-container');
        
        if (deck.cards.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🃏</div>
                    <div class="empty-state-text">Aucune carte. Ajoutez-en une pour commencer !</div>
                </div>
            `;
            return;
        }
        
        const now = Date.now();
        
        container.innerHTML = deck.cards.map((card, index) => {
            const cardScore = card.cardScore || 0;
            
            // Couleur selon le score (système de zones)
            const cardColor = ColorZones.getCardColor(cardScore);
            const zoneName = ColorZones.getZoneName(cardScore);
            
            return `
                <div class="card-item">
                    <div class="card-color-band" style="background-color: ${cardColor};"></div>
                    <div class="card-item-header">
                        <strong>Carte ${index + 1}</strong>
                        <span style="font-size: 11px; color: ${cardColor}; font-weight: 600; margin-left: 10px;">
                            ${zoneName}
                        </span>
                    </div>
                    <div class="card-item-content">
                        <strong>Question:</strong> ${this.escapeHtml(card.front)}<br>
                        <strong>Réponse:</strong> ${this.escapeHtml(card.back)}
                    </div>
                    <div class="card-item-actions">
                        <button class="card-action-btn" onclick="App.editCard(${index})">Modifier</button>
                        <button class="card-action-btn" onclick="App.deleteCard(${index})" style="color: var(--error);">Supprimer</button>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // ============================================
    // MODALS - IDs CORRIGÉS POUR ÉVITER LES CONFLITS
    // ============================================
    
    showModal(title, content) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-content').innerHTML = content;
        document.getElementById('modal-overlay').classList.remove('hidden');
    },
    
    hideModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },
    
    showAddDeckModal() {
        const content = `
            <form id="add-deck-form">
                <div class="form-group">
                    <label for="deck-name">Nom du deck</label>
                    <input type="text" id="deck-name" required placeholder="Ex: Vocabulaire anglais">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="App.hideModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary">Créer</button>
                </div>
            </form>
        `;
        
        this.showModal('Nouveau deck', content);
        
        setTimeout(() => {
            const form = document.getElementById('add-deck-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const name = document.getElementById('deck-name').value.trim();
                    if (name) {
                        this.createDeck(name);
                        this.hideModal();
                    }
                });
            }
        }, 10);
    },
    
    showEditDeckModal() {
        if (!this.currentDeckId) return;
        const deck = Storage.getDeck(this.currentDeckId);
        if (!deck) return;
        
        const content = `
            <form id="edit-deck-form">
                <div class="form-group">
                    <label for="edit-deck-name">Nom du deck</label>
                    <input type="text" id="edit-deck-name" value="${this.escapeHtml(deck.name)}" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="App.hideModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        `;
        
        this.showModal('Modifier le deck', content);
        
        setTimeout(() => {
            const form = document.getElementById('edit-deck-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const name = document.getElementById('edit-deck-name').value.trim();
                    if (name) {
                        this.updateDeck(name);
                        this.hideModal();
                    }
                });
            }
        }, 10);
    },
    
    showReviewSettingsModal() {
        const content = `
            <form id="review-settings-form">
                <div class="form-group">
                    <label for="cards-per-session">Nombre de cartes par session</label>
                    <input type="number" id="cards-per-session" min="1" max="100" value="${this.cardsPerSession}" required>
                    <small style="color: var(--text-secondary); display: block; margin-top: 5px;">
                        Les cartes les plus difficiles seront privilégiées
                    </small>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="App.hideModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        `;
        
        this.showModal('Paramètres de révision', content);
        
        setTimeout(() => {
            const form = document.getElementById('review-settings-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const cardsPerSession = parseInt(document.getElementById('cards-per-session').value);
                    if (cardsPerSession > 0 && cardsPerSession <= 100) {
                        this.cardsPerSession = cardsPerSession;
                        // Sauvegarder dans localStorage
                        localStorage.setItem('flashcards_cardsPerSession', cardsPerSession.toString());
                        this.hideModal();
                        alert(`Configuration enregistrée : ${cardsPerSession} cartes par session`);
                    } else {
                        alert('Veuillez entrer un nombre entre 1 et 100');
                    }
                });
            }
        }, 10);
    },
    
    showStatsModal() {
        if (!this.currentDeckId) return;
        const deck = Storage.getDeck(this.currentDeckId);
        if (!deck) return;
        
        const now = Date.now();
        const cardsWithStats = deck.cards.map((card, index) => {
            const againCount = card.againCount || 0;
            const cardScore = card.cardScore || 0;
            const isDue = !card.nextReview || card.nextReview <= now;
            const daysSinceLastReview = card.lastReview 
                ? Math.floor((now - card.lastReview) / (24 * 60 * 60 * 1000))
                : 999;
            
            return {
                index: index,
                card: card,
                againCount: againCount,
                cardScore: cardScore,
                isDue: isDue,
                daysSinceLastReview: daysSinceLastReview,
                nextReview: card.nextReview ? new Date(card.nextReview).toLocaleDateString('fr-FR') : 'Jamais'
            };
        });
        
        // Trier par score (croissant = les plus difficiles en premier)
        cardsWithStats.sort((a, b) => {
            if (a.cardScore !== b.cardScore) {
                return a.cardScore - b.cardScore; // Tri croissant
            }
            if (a.isDue !== b.isDue) {
                return a.isDue ? -1 : 1;
            }
            if (b.againCount !== a.againCount) {
                return b.againCount - a.againCount;
            }
            return (a.card.nextReview || 0) - (b.card.nextReview || 0);
        });
        
        const totalCards = deck.cards.length;
        const totalAgainClicks = deck.cards.reduce((sum, card) => sum + (card.againCount || 0), 0);
        const totalCardScore = deck.cards.reduce((sum, card) => sum + (card.cardScore || 0), 0);
        const cardsDue = deck.cards.filter(card => !card.nextReview || card.nextReview <= now).length;
        const avgAgainCount = totalCards > 0 ? (totalAgainClicks / totalCards).toFixed(1) : 0;
        const avgCardScore = totalCards > 0 ? (totalCardScore / totalCards).toFixed(1) : 0;
        
        const statsHtml = `
            <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
                <h3 style="margin-top: 0; margin-bottom: 10px;">📊 Statistiques du deck</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; font-size: 14px;">
                    <div><strong>Total cartes:</strong> ${totalCards}</div>
                    <div><strong>Cartes à réviser:</strong> ${cardsDue}</div>
                    <div><strong>Total clics "Encore":</strong> ${totalAgainClicks}</div>
                    <div><strong>Score total:</strong> <span style="color: #2196F3;">${totalCardScore}</span></div>
                    <div><strong>Moyenne "Encore":</strong> ${avgAgainCount} par carte</div>
                    <div><strong>Score moyen:</strong> ${avgCardScore}</div>
                </div>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
                <h4 style="margin-top: 0;">Classement par difficulté (les plus difficiles en premier)</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: var(--bg-secondary); position: sticky; top: 0;">
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid var(--border-color);">#</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 2px solid var(--border-color);">Carte</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 2px solid var(--border-color);">🔴 Encore</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 2px solid var(--border-color);">📊 Score</th>
                            <th style="padding: 8px; text-align: center; border-bottom: 2px solid var(--border-color);">📅 Prochaine</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cardsWithStats.map((stat, idx) => {
                            const cardColor = ColorZones.getCardColor(stat.cardScore);
                            
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td style="padding: 8px; font-weight: 600; color: ${cardColor};">${idx + 1}</td>
                                    <td style="padding: 8px;">
                                        <strong>Carte ${stat.index + 1}</strong><br>
                                        <small style="color: var(--text-secondary);">${this.escapeHtml(stat.card.front.substring(0, 40))}${stat.card.front.length > 40 ? '...' : ''}</small>
                                    </td>
                                    <td style="padding: 8px; text-align: center; color: ${cardColor}; font-weight: 600;">${stat.againCount}</td>
                                    <td style="padding: 8px; text-align: center; font-weight: 600; color: ${cardColor};">${stat.cardScore}</td>
                                    <td style="padding: 8px; text-align: center; font-size: 11px;">${stat.nextReview}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        this.showModal('Statistiques du deck', statsHtml);
    },
    
    showAddCardModal() {
        if (!this.currentDeckId) {
            alert('Veuillez d\'abord ouvrir un deck');
            return;
        }
        
        // IDs MODIFIÉS: input-card-front et input-card-back pour éviter conflit
        const content = `
            <form id="add-card-form">
                <div class="form-group">
                    <label for="input-card-front">Question</label>
                    <textarea id="input-card-front" required placeholder="Texte de la question"></textarea>
                </div>
                <div class="form-group">
                    <label for="input-card-back">Réponse</label>
                    <textarea id="input-card-back" required placeholder="Texte de la réponse"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="App.hideModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary">Ajouter</button>
                </div>
            </form>
        `;
        
        this.showModal('Nouvelle carte', content);
        
        setTimeout(() => {
            const form = document.getElementById('add-card-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const front = document.getElementById('input-card-front').value.trim();
                    const back = document.getElementById('input-card-back').value.trim();
                    if (front && back) {
                        this.createCard(front, back);
                        this.hideModal();
                    } else {
                        alert('Veuillez remplir les deux champs');
                    }
                });
            }
        }, 10);
    },
    
    showEditCardModal(cardIndex) {
        if (!this.currentDeckId) return;
        const deck = Storage.getDeck(this.currentDeckId);
        if (!deck || !deck.cards[cardIndex]) return;
        
        const card = deck.cards[cardIndex];
        
        // IDs MODIFIÉS: input-edit-card-front et input-edit-card-back
        const content = `
            <form id="edit-card-form">
                <div class="form-group">
                    <label for="input-edit-card-front">Question</label>
                    <textarea id="input-edit-card-front" required>${this.escapeHtml(card.front)}</textarea>
                </div>
                <div class="form-group">
                    <label for="input-edit-card-back">Réponse</label>
                    <textarea id="input-edit-card-back" required>${this.escapeHtml(card.back)}</textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="App.hideModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        `;
        
        this.showModal('Modifier la carte', content);
        
        setTimeout(() => {
            const form = document.getElementById('edit-card-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const front = document.getElementById('input-edit-card-front').value.trim();
                    const back = document.getElementById('input-edit-card-back').value.trim();
                    if (front && back) {
                        this.updateCard(cardIndex, front, back);
                        this.hideModal();
                    } else {
                        alert('Veuillez remplir les deux champs');
                    }
                });
            }
        }, 10);
    },
    
    // ============================================
    // GESTION DES DECKS
    // ============================================
    
    createDeck(name) {
        const deck = {
            id: Date.now().toString(),
            name: name,
            cards: [],
            createdAt: Date.now()
        };
        
        Storage.saveDeck(deck);
        this.renderDecks();
    },
    
    updateDeck(name) {
        if (!this.currentDeckId) return;
        const deck = Storage.getDeck(this.currentDeckId);
        if (deck) {
            deck.name = name;
            Storage.saveDeck(deck);
            document.getElementById('deck-title').textContent = name;
            this.renderDecks();
        }
    },
    
    deleteDeck(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce deck ?')) {
            Storage.deleteDeck(id);
            if (this.currentDeckId === id) {
                this.showDecksView();
            } else {
                this.renderDecks();
            }
        }
    },
    
    // ============================================
    // GESTION DES CARTES
    // ============================================
    
    createCard(front, back) {
        if (!this.currentDeckId) {
            console.error('Aucun deck sélectionné');
            return;
        }
        
        const deck = Storage.getDeck(this.currentDeckId);
        if (!deck) {
            console.error('Deck non trouvé');
            return;
        }
        
        const card = {
            front: front,
            back: back,
            easeFactor: 2.5,
            interval: 1,
            repetitions: 0,
            againCount: 0,
            cardScore: 0,
            nextReview: null,
            lastReview: null
        };
        
        deck.cards.push(card);
        Storage.saveDeck(deck);
        this.renderCards();
        this.renderDecks();
    },
    
    editCard(index) {
        this.showEditCardModal(index);
    },
    
    updateCard(index, front, back) {
        if (!this.currentDeckId) return;
        const deck = Storage.getDeck(this.currentDeckId);
        if (deck && deck.cards[index]) {
            deck.cards[index].front = front;
            deck.cards[index].back = back;
            Storage.saveDeck(deck);
            this.renderCards();
        }
    },
    
    deleteCard(index) {
        if (!this.currentDeckId) return;
        if (confirm('Êtes-vous sûr de vouloir supprimer cette carte ?')) {
            const deck = Storage.getDeck(this.currentDeckId);
            if (deck && deck.cards[index]) {
                deck.cards.splice(index, 1);
                Storage.saveDeck(deck);
                this.renderCards();
                this.renderDecks();
            }
        }
    },
    
    // ============================================
    // RÉVISION
    // ============================================
    
    renderReviewCard() {
        if (this.currentReviewIndex >= this.reviewCards.length) {
            const reviewCard = document.getElementById('review-card');
            const reviewButtons = document.getElementById('review-buttons');
            const reviewProgress = document.getElementById('review-progress');
            
            if (reviewCard) {
                reviewCard.innerHTML = `
                    <div class="card-side">
                        <p>🎉 Félicitations !<br><br>Vous avez terminé toutes les cartes à réviser.</p>
                    </div>
                `;
            }
            if (reviewButtons) {
                reviewButtons.classList.add('hidden');
            }
            if (reviewProgress) {
                reviewProgress.textContent = 'Terminé';
            }
            return;
        }
        
        // Restaurer la structure HTML si elle a été modifiée
        const reviewCard = document.getElementById('review-card');
        if (reviewCard && !reviewCard.querySelector('#card-front')) {
            reviewCard.innerHTML = `
                <div id="card-front" class="card-side">
                    <div id="review-card-color-band" class="review-card-color-band"></div>
                    <p id="front-text"></p>
                </div>
                <div id="card-back" class="card-side hidden">
                    <div id="review-card-color-band-back" class="review-card-color-band"></div>
                    <p id="back-text"></p>
                </div>
                <div id="reveal-hint" class="reveal-hint">Tapez pour révéler</div>
            `;
        }
        
        const card = this.reviewCards[this.currentReviewIndex];
        const total = this.reviewCards.length;
        const current = this.currentReviewIndex + 1;
        const cardScore = card.cardScore || 0;
        const cardColor = ColorZones.getCardColor(cardScore);
        
        const frontText = document.getElementById('front-text');
        const backText = document.getElementById('back-text');
        const cardFront = document.getElementById('card-front');
        const cardBack = document.getElementById('card-back');
        const revealHint = document.getElementById('reveal-hint');
        const reviewButtons = document.getElementById('review-buttons');
        const reviewProgress = document.getElementById('review-progress');
        const colorBand = document.getElementById('review-card-color-band');
        const colorBandBack = document.getElementById('review-card-color-band-back');
        
        if (frontText) frontText.textContent = card.front;
        if (backText) backText.textContent = card.back;
        if (cardFront) cardFront.classList.remove('hidden');
        if (cardBack) cardBack.classList.add('hidden');
        if (revealHint) revealHint.style.display = 'block';
        if (reviewButtons) reviewButtons.classList.add('hidden');
        if (reviewProgress) reviewProgress.textContent = `${current} / ${total}`;
        if (colorBand) colorBand.style.backgroundColor = cardColor;
        if (colorBandBack) colorBandBack.style.backgroundColor = cardColor;
        
        this.isRevealed = false;
    },
    
    revealAnswer() {
        if (this.isRevealed) return;
        
        const cardFront = document.getElementById('card-front');
        const cardBack = document.getElementById('card-back');
        const revealHint = document.getElementById('reveal-hint');
        const reviewButtons = document.getElementById('review-buttons');
        
        if (!cardFront || !cardBack || !revealHint || !reviewButtons) return;
        
        this.isRevealed = true;
        cardFront.classList.add('hidden');
        cardBack.classList.remove('hidden');
        revealHint.style.display = 'none';
        reviewButtons.classList.remove('hidden');
    },
    
    rateCard(quality) {
        if (this.currentReviewIndex >= this.reviewCards.length) return;
        
        const card = this.reviewCards[this.currentReviewIndex];
        const deck = Storage.getDeck(this.currentDeckId);
        
        if (deck) {
            const deckCard = deck.cards.find(c => c.front === card.front && c.back === card.back);
            if (deckCard) {
                SM2.calculateNextReview(deckCard, quality);
                Storage.saveDeck(deck);
            }
        }
        
        this.currentReviewIndex++;
        this.renderReviewCard();
    },
    
    // ============================================
    // IMPORT / EXPORT
    // ============================================
    
    exportDeck() {
        if (!this.currentDeckId) return;
        const deck = Storage.getDeck(this.currentDeckId);
        if (!deck) return;
        
        const exportData = {
            name: deck.name,
            cards: deck.cards.map(card => ({
                front: card.front,
                back: card.back
            }))
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${deck.name.replace(/[^a-z0-9]/gi, '_')}.json`;
        link.click();
        URL.revokeObjectURL(url);
    },
    
    importDeck(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        const self = this; // Sauvegarder la référence à 'this'
        
        reader.onload = (e) => {
            try {
                const fileContent = e.target.result;
                console.log('Contenu du fichier (premiers 500 caractères):', fileContent.substring(0, 500));
                
                const importData = JSON.parse(fileContent);
                console.log('Données JSON parsées:', importData);
                console.log('Type de importData.cards:', typeof importData.cards, Array.isArray(importData.cards));
                
                // Vérifier le format
                if (!importData.name) {
                    throw new Error('Le fichier doit contenir un champ "name"');
                }
                
                // Vérifier si cards existe et est un tableau
                if (importData.cards === undefined || importData.cards === null) {
                    throw new Error('Le fichier doit contenir un champ "cards" (tableau)');
                }
                
                if (!Array.isArray(importData.cards)) {
                    console.error('cards n\'est pas un tableau:', importData.cards);
                    throw new Error(`Le champ "cards" doit être un tableau. Type reçu: ${typeof importData.cards}`);
                }
                
                console.log('Nombre de cartes dans le fichier:', importData.cards.length);
                
                // Permettre l'importation d'un deck vide (on peut ajouter des cartes après)
                if (importData.cards.length === 0) {
                    console.warn('Le deck est vide (aucune carte). Le deck sera créé mais sans cartes.');
                }
                
                // Créer le deck avec toutes les cartes
                let validCardsCount = 0;
                let invalidCardsCount = 0;
                
                const cards = importData.cards.map((card, index) => {
                    // Vérifier que chaque carte a les champs requis
                    if (!card) {
                        console.warn(`Carte ${index + 1} est null ou undefined`);
                        invalidCardsCount++;
                        return null;
                    }
                    
                    if (typeof card !== 'object') {
                        console.warn(`Carte ${index + 1} n'est pas un objet:`, card);
                        invalidCardsCount++;
                        return null;
                    }
                    
                    // Accepter front/back même s'ils sont vides (on les trimmera)
                    const front = card.front !== undefined && card.front !== null ? String(card.front).trim() : '';
                    const back = card.back !== undefined && card.back !== null ? String(card.back).trim() : '';
                    
                    if (!front || !back) {
                        console.warn(`Carte ${index + 1} ignorée: champs manquants ou vides`, {
                            front: front || '(vide)',
                            back: back || '(vide)',
                            card: card
                        });
                        invalidCardsCount++;
                        return null;
                    }
                    
                    validCardsCount++;
                    return {
                        front: front,
                        back: back,
                        easeFactor: 2.5,
                        interval: 1,
                        repetitions: 0,
                        againCount: 0,
                        cardScore: 0,
                        nextReview: null,
                        lastReview: null
                    };
                }).filter(card => card !== null); // Filtrer les cartes invalides
                
                console.log(`Cartes valides: ${validCardsCount}, invalides: ${invalidCardsCount}`);
                
                if (cards.length === 0) {
                    throw new Error(`Aucune carte valide trouvée dans le fichier. ${invalidCardsCount} carte(s) invalide(s) détectée(s). Vérifiez que chaque carte a les champs "front" et "back".`);
                }
                
                const deck = {
                    id: Date.now().toString(),
                    name: importData.name,
                    cards: cards,
                    createdAt: Date.now()
                };
                
                Storage.saveDeck(deck);
                self.renderDecks();
                
                let message = `Deck "${deck.name}" importé avec succès !\n${deck.cards.length} carte(s) importée(s).`;
                if (deck.cards.length === 0) {
                    message += '\n\nLe deck est vide. Vous pouvez ajouter des cartes en ouvrant le deck.';
                }
                if (invalidCardsCount > 0) {
                    message += `\n${invalidCardsCount} carte(s) invalide(s) ignorée(s).`;
                }
                alert(message);
                
            } catch (error) {
                console.error('Erreur lors de l\'import:', error);
                console.error('Stack trace:', error.stack);
                alert('Erreur lors de l\'import : ' + error.message + '\n\nVérifiez la console (F12) pour plus de détails.');
            }
        };
        
        reader.onerror = () => {
            alert('Erreur lors de la lecture du fichier');
        };
        
        reader.readAsText(file);
        event.target.value = '';
    },
    
    // ============================================
    // SERVICE WORKER
    // ============================================
    
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            // Vérifier que nous ne sommes pas en mode file://
            if (window.location.protocol === 'file:') {
                console.log('Service Worker désactivé en mode file://');
                return;
            }
            
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./service-worker.js')
                    .then(reg => console.log('Service Worker enregistré'))
                    .catch(err => {
                        // Ignorer silencieusement l'erreur en mode développement
                        if (window.location.protocol !== 'file:') {
                            console.log('Erreur Service Worker:', err);
                        }
                    });
            });
        }
    },
    
    // ============================================
    // UTILITAIRES
    // ============================================
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialiser l'application au chargement
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
