// search-sort.js - Search, sort, and tag filtering

export const SearchSort = {
  currentSearchQuery: '',
  currentSortOption: 'default',
  currentTagFilter: 'all',

  init() {
    this.currentSearchQuery = localStorage.getItem('flashcards_searchQuery') || '';
    this.currentSortOption = localStorage.getItem('flashcards_sortOption') || 'default';
    this.currentTagFilter = localStorage.getItem('flashcards_tagFilter') || 'all';
  },

  getAllTags() {
    const store = window.AppState;
    const decks = store.localDecks || [];
    const tags = new Set();
    decks.forEach(deck => {
      if (deck.tags?.length) {
        deck.tags.forEach(t => tags.add(t));
      }
    });
    return Array.from(tags).sort();
  },

  renderTagsFilter() {
    const container = document.getElementById('tags-filter');
    if (!container) return;

    const tags = this.getAllTags();
    if (tags.length === 0) {
      container.innerHTML = '';
      return;
    }

    const allTags = ['all', ...tags];
    container.innerHTML = allTags.map(tag => `
      <button class="tag-filter-btn ${this.currentTagFilter === tag || (tag === 'all' && this.currentTagFilter === 'all') ? 'active' : ''}" data-tag="${tag}">
        ${tag === 'all' ? 'Tous' : escHtml(tag)}
      </button>
    `).join('');

    container.querySelectorAll('.tag-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTagFilter = btn.dataset.tag;
        localStorage.setItem('flashcards_tagFilter', this.currentTagFilter);
        container.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.DeckManager?.renderDecks();
      });
    });
  },

  filterDecksByTag(decks) {
    if (this.currentTagFilter === 'all' || !this.currentTagFilter) return decks;
    return decks.filter(deck => deck.tags?.includes(this.currentTagFilter));
  },

  setupCardSearchSort() {
    const searchInput = document.getElementById('cards-search');
    const sortSelect = document.getElementById('cards-sort');
    const clearBtn = document.getElementById('search-clear');

    if (searchInput) {
      searchInput.value = this.currentSearchQuery;
      if (this.currentSearchQuery) clearBtn?.classList.remove('hidden');

      const debouncedSearch = debounceUtil((value) => {
        this.currentSearchQuery = value;
        localStorage.setItem('flashcards_searchQuery', value);
        window.DeckManager?.renderCards();
      }, 300);

      searchInput.addEventListener('input', e => {
        const val = e.target.value;
        if (val) clearBtn?.classList.remove('hidden');
        else clearBtn?.classList.add('hidden');
        debouncedSearch(val);
      });

      clearBtn?.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          this.currentSearchQuery = '';
          clearBtn.classList.add('hidden');
          window.DeckManager?.renderCards();
        }
      });
    }

    if (sortSelect) {
      if (this.currentSortOption) sortSelect.value = this.currentSortOption;
      sortSelect.addEventListener('change', e => {
        this.currentSortOption = e.target.value;
        localStorage.setItem('flashcards_sortOption', e.target.value);
        window.DeckManager?.renderCards();
      });
    }
  },

  filterAndSortCards(cards) {
    let filtered = [...cards];

    if (this.currentSearchQuery) {
      const q = this.currentSearchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        (c.front?.toLowerCase().includes(q)) ||
        (c.back?.toLowerCase().includes(q))
      );
    }

    const sortOpt = this.currentSortOption;
    filtered.sort((a, b) => {
      switch (sortOpt) {
        case 'alpha-asc':
          return (a.front || '').localeCompare(b.front || '');
        case 'alpha-desc':
          return (b.front || '').localeCompare(a.front || '');
        case 'score-asc':
          return (a.cardScore ?? 0) - (b.cardScore ?? 0);
        case 'score-desc':
          return (b.cardScore ?? 0) - (a.cardScore ?? 0);
        case 'date-asc':
          return (a.createdAt || 0) - (b.createdAt || 0);
        case 'date-desc':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'due':
          return (a.nextReview || 0) - (b.nextReview || 0);
        default:
          return (a.createdAt || 0) - (b.createdAt || 0);
      }
    });

    return filtered;
  }
};

const escHtml = window.Utils?.escapeHtml || ((text) => {
  if (text == null) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
});

const debounceUtil = window.Utils?.debounce || ((fn, delay = 250) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
});

window.SearchSort = SearchSort;