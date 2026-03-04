// Initialize DOM Elements
const views = {
    intro: document.getElementById('view-intro'),
    roulette: document.getElementById('view-roulette'),
    search: document.getElementById('view-search'),
    favorites: document.getElementById('view-favorites'),
    add: document.getElementById('view-add')
};

const elems = {
    card: document.getElementById('joke-card'),
    cardQ: document.getElementById('card-question'),
    cardA: document.getElementById('card-answer'),
    cardCat: document.getElementById('card-category'),
    cardTags: document.getElementById('card-tags'),
    spinner: document.getElementById('roulette-spinner'),
    btnStart: document.getElementById('btn-start-roulette'),
    btnSpin: document.getElementById('btn-spin'),
    btnFav: document.getElementById('btn-favorite'),
    btnShare: document.getElementById('btn-share'),
    stars: document.querySelectorAll('#rating-stars span'),
    searchInput: document.getElementById('search-input'),
    catFilter: document.getElementById('filter-category'),
    resultsGrid: document.getElementById('search-results-grid'),
    favGrid: document.getElementById('favorites-grid'),
    overlay: document.getElementById('loading-overlay'),
    adminContainer: document.getElementById('admin-hide-container'),
    toastContainer: document.getElementById('toast-container')
};

let rawJokes = [];
let validJokes = [];
let currentJoke = null;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Make forms use configured URLs
    document.getElementById('add-joke-form').action = CONFIG.SCRIPT_POST_URL;
    document.getElementById('rate-joke-form').action = CONFIG.SCRIPT_POST_URL;
    document.getElementById('hide-joke-form').action = CONFIG.SCRIPT_POST_URL;

    setupTheme();
    setupEventListeners();
    await fetchJokes();
});

// Setup Event Listeners
function setupEventListeners() {
    // Navigation
    document.getElementById('nav-home').onclick = () => switchView('intro');
    document.getElementById('nav-favorites').onclick = () => switchView('favorites');
    document.getElementById('nav-add').onclick = () => switchView('add');
    document.getElementById('btn-back-from-search').onclick = () => switchView('roulette');
    document.getElementById('btn-back-from-fav').onclick = () => switchView('roulette');
    document.getElementById('btn-back-from-add').onclick = () => switchView('roulette');

    // Theme
    document.getElementById('theme-toggle').onclick = () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    };

    // Card Flip
    elems.card.onclick = () => {
        if (!elems.card.classList.contains('is-flipped')) {
            elems.card.classList.add('is-flipped');
        }
    };

    // Spin
    elems.btnSpin.onclick = startSpinning;
    elems.btnStart.onclick = () => {
        switchView('roulette');
        // Initial random wait feel
        startSpinning();
    };

    // Share
    elems.btnShare.onclick = shareCurrentJoke;

    // Search
    elems.searchInput.addEventListener('input', performSearch);
    elems.catFilter.addEventListener('change', performSearch);

    // Rating
    elems.stars.forEach(star => {
        star.onclick = (e) => submitRating(e.target.dataset.val);
    });

    // Favorites
    elems.btnFav.onclick = toggleFavorite;

    // Admin Mode
    document.getElementById('nav-admin').onclick = () => {
        elems.adminContainer.classList.toggle('hidden');
    };
    document.getElementById('btn-hide-joke').onclick = hideCurrentJoke;

    // Forms success catch via hidden iframe
    document.getElementById('hidden_iframe').onload = () => {
        // since we can't accurately detect cross-origin load payload without error,
        // we assume success and show toast if it was a submission we tracked
    };
    document.getElementById('btn-submit-add').onclick = () => {
        setTimeout(() => {
            showToast("제출 완료! (검토 후 반영됩니다)");
            document.getElementById('add-joke-form').reset();
            switchView('roulette');
        }, 1000);
    };
}

function setupTheme() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }
}

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('active');

    if (viewName === 'favorites') {
        renderFavorites();
    }
}

// Fetch from Google Sheets gviz JSON
async function fetchJokes() {
    try {
        const response = await fetch(CONFIG.GVIZ_URL);
        const text = await response.text();

        // Parse gviz JSON wrapper text
        // Usually returns format: /*O_o*/ google.visualization.Query.setResponse({"version":"0.6","reqId":"0","status":"ok","sig":"...","table":{"cols":[...],"rows":[...]}})
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
        if (jsonMatch && jsonMatch[1]) {
            const data = JSON.parse(jsonMatch[1]);
            const cols = data.table.cols.map(c => c.label || c.id);
            const rawRows = data.table.rows;

            rawJokes = rawRows.map(row => {
                let obj = {};
                row.c.forEach((cell, idx) => {
                    if (cols[idx]) obj[cols[idx]] = cell ? cell.v : '';
                });
                return obj;
            });

            // Filter out hidden & low quality and apply requirements
            validJokes = rawJokes.filter(j =>
                String(j.hidden).toUpperCase() !== 'TRUE' &&
                Number(j.qualityScore || 0) >= 40
            );

            populateCategories();
            elems.overlay.classList.add('hidden');

            // Initial Random Joke
            loadNextJoke();
        } else {
            throw new Error("Invalid Gviz Response");
        }
    } catch (e) {
        console.error(e);
        elems.overlay.querySelector('p').innerText = "데이터를 불러오는데 실패했습니다. GVIZ_URL을 확인하세요.";
    }
}

function populateCategories() {
    const cats = new Set(validJokes.map(j => j.category).filter(Boolean));
    elems.catFilter.innerHTML = '<option value="">모든 카테고리</option>';
    cats.forEach(c => {
        elems.catFilter.innerHTML += `<option value="${c}">${c}</option>`;
    });
}

// Recommendation Engine Algorithm
let lastJokes = [];
function getNextJoke() {
    // We compute a recommendation score for each joke
    // score = qualityScore * 0.6 + ratingAverage * 20
    const weightedJokes = validJokes.map(j => {
        const ratingSum = Number(j.ratingSum) || 0;
        const ratingCount = Number(j.ratingCount) || 0;
        const avg = ratingCount > 0 ? ratingSum / ratingCount : 3; // Default 3 stars
        const quality = Number(j.qualityScore) || 50;

        let score = (quality * 0.6) + (avg * 20);

        // Avoid recent exact duplication
        if (lastJokes.includes(j.id)) {
            score = 0; // Don't pick again soon
        }

        return { ...j, recScore: Math.random() * score }; // Randomness added
    });

    weightedJokes.sort((a, b) => b.recScore - a.recScore);
    const chosen = weightedJokes[0] || validJokes[Math.floor(Math.random() * validJokes.length)];

    lastJokes.push(chosen.id);
    if (lastJokes.length > 20) lastJokes.shift();

    return chosen;
}

function startSpinning() {
    elems.spinner.classList.add('spinning');
    elems.card.classList.remove('is-flipped');
    elems.btnSpin.disabled = true;

    // Simulate 1.5s spinning
    setTimeout(() => {
        elems.spinner.classList.remove('spinning');
        elems.btnSpin.disabled = false;
        loadNextJoke();
    }, 1500);
}

function loadNextJoke() {
    const next = getNextJoke();
    currentJoke = next;

    elems.cardQ.innerText = next.question;
    elems.cardA.innerText = next.answer;
    elems.cardCat.innerText = next.category;

    // reset UI
    elems.card.classList.remove('is-flipped');
    elems.stars.forEach(s => s.classList.remove('active'));

    const tags = (next.tags || '').split(',').filter(Boolean);
    elems.cardTags.innerHTML = tags.map(t => `<span class="tag">#${t.trim()}</span>`).join('');

    // Check Fav status
    updateFavButtonUI();
}

function updateFavButtonUI() {
    const favs = JSON.parse(localStorage.getItem('favJokes') || '[]');
    if (currentJoke && favs.some(f => f.id === currentJoke.id)) {
        elems.btnFav.innerHTML = "❤️ 보관됨";
        elems.btnFav.style.background = "var(--primary-color)";
    } else {
        elems.btnFav.innerHTML = "🤍 즐겨찾기";
        elems.btnFav.style.background = "rgba(255,255,255,0.2)";
    }
}

// Actions
function submitRating(val) {
    elems.stars.forEach(s => s.classList.remove('active'));
    for (let i = 0; i < val; i++) {
        elems.stars[i].classList.add('active');
    }
    document.getElementById('rate-id').value = currentJoke.id;
    document.getElementById('rate-stars').value = val;
    document.getElementById('rate-joke-form').submit();
    showToast(`별점 ${val}점이 등록되었습니다!`);
}

function toggleFavorite() {
    let favs = JSON.parse(localStorage.getItem('favJokes') || '[]');
    const isFav = favs.some(f => f.id === currentJoke.id);

    if (isFav) {
        favs = favs.filter(f => f.id !== currentJoke.id);
    } else {
        favs.push({
            id: currentJoke.id,
            q: currentJoke.question,
            a: currentJoke.answer
        });
    }
    localStorage.setItem('favJokes', JSON.stringify(favs));
    updateFavButtonUI();
    showToast(isFav ? "보관함에서 제거됨" : "보관함에 저장됨!");
}

function shareCurrentJoke() {
    if (!currentJoke) return;
    const textToShare = `😂 아재력 테스트!\nQ. ${currentJoke.question}\nA. ${currentJoke.answer}\n\n👉 나도 아재개그 해보기: https://songbongs.github.io/dad-joke-generator/`;

    if (navigator.share) {
        navigator.share({
            title: '아재개그 랜덤 룰렛',
            text: textToShare,
        }).catch(console.error);
    } else {
        // Fallback to clipboard
        navigator.clipboard.writeText(textToShare).then(() => {
            showToast("클립보드에 복사되었습니다!");
        }).catch(err => {
            showToast("공유하기를 지원하지 않는 브라우저입니다.");
        });
    }
}

function hideCurrentJoke() {
    const pin = document.getElementById('admin-pin-input').value;
    if (!pin) return showToast("PIN을 입력하세요");

    document.getElementById('hide-id').value = currentJoke.id;
    document.getElementById('hide-pin').value = pin;
    document.getElementById('hide-joke-form').submit();
    showToast("블랙리스트 요청 전송됨");
    elems.adminContainer.classList.add('hidden');
    loadNextJoke();
}

// Search & Rendering Grids
function performSearch() {
    switchView('search');
    const term = elems.searchInput.value.toLowerCase().trim();
    const cat = elems.catFilter.value;

    const results = validJokes.filter(j => {
        const matchCat = !cat || j.category === cat;
        const matchTerm = !term ||
            (j.question && j.question.toLowerCase().includes(term)) ||
            (j.answer && j.answer.toLowerCase().includes(term)) ||
            (j.tags && j.tags.toLowerCase().includes(term));
        return matchCat && matchTerm;
    });

    renderGrid(elems.resultsGrid, results, term.length === 0 && !cat);
}

function renderFavorites() {
    const favs = JSON.parse(localStorage.getItem('favJokes') || '[]');
    renderGrid(elems.favGrid, favs.map(f => ({ question: f.q, answer: f.a })), false);
}

function renderGrid(container, items, isInitialSearch) {
    if (isInitialSearch) {
        container.innerHTML = "<p>검색어나 카테고리를 선택하여 탐색하세요!</p>";
        return;
    }
    if (items.length === 0) {
        container.innerHTML = "<p>결과가 없습니다.</p>";
        return;
    }

    container.innerHTML = items.map((j, i) => `
        <div class="mini-card glass-panel" onclick="this.classList.toggle('revealed')">
            <span class="tag">클릭해서 정답보기</span>
            <hr style="margin: 0.5rem 0; opacity: 0.2;">
            <h3>Q. ${j.question}</h3>
            <p>A. ${j.answer}</p>
        </div>
    `).join('');
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    elems.toastContainer.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3300);
}
