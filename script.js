// --- Settings & State ---
const RAW_ANSWERS_URL = "answers.txt"; 
const RAW_GUESSES_URL = "guesses.txt"; 

let allAnswers = [];
let allGuesses = [];
let possibleWords = [];
let activeAnswerSet = 'answers';
let currentSortKey = 'expectedRemaining';
let currentAnalysis = [];

// --- Elements ---
const el = {
    input: document.getElementById("guessInput"),
    addBtn: document.getElementById("addRowBtn"),
    applyBtn: document.getElementById("applyBtn"),
    resetBtn: document.getElementById("resetBtn"),
    toggleBtn: document.getElementById("toggleAnswersBtn"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    suggestions: document.getElementById("suggestions"),
    computing: document.getElementById("computing"),
    possibleCount: document.getElementById("possibleCount"),
    minGuesses: document.getElementById("minGuesses"),
    expectedAfter: document.getElementById("expectedAfter"),
    avgSkill: document.getElementById("avgSkill"),
    possibleAnswersWrap: document.getElementById("possibleAnswersWrap"),
    possibleAnswers: document.getElementById("possibleAnswers"),
    sortExp: document.getElementById("sortExpBtn"),
    sortEnt: document.getElementById("sortEntropyBtn"),
    sortScore: document.getElementById("sortScoreBtn")
};

// --- Initialization ---
async function init() {
    el.status.textContent = "Loading words...";
    try {
        const [resA, resG] = await Promise.all([
            fetch(RAW_ANSWERS_URL, { cache: "no-cache" }), 
            fetch(RAW_GUESSES_URL, { cache: "no-cache" })
        ]);
        
        const txtA = await resA.text();
        const txtG = await resG.text();

        allAnswers = txtA.split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(Boolean);
        const uniqueGuesses = txtG.split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(Boolean);
        
        // Combine unique guesses and all answers into the definitive guessable list
        allGuesses = Array.from(new Set([...uniqueGuesses, ...allAnswers]));
        
        resetAll();
        el.status.textContent = `Ready! ${allAnswers.length} answers, ${allGuesses.length} total guesses.`;
    } catch (e) {
        console.error(e);
        el.status.textContent = "Error loading words. Ensure answers.txt and guesses.txt exist.";
    }
}

// --- Event Listeners ---
el.addBtn.onclick = () => onAddRow(el.input.value);
el.applyBtn.onclick = onApplyFeedback;
el.resetBtn.onclick = () => resetAll();
el.toggleBtn.onclick = toggleAnswerMode;
el.analyzeBtn.onclick = promptAnalyze;
el.sortExp.onclick = () => setSort('expectedRemaining');
el.sortEnt.onclick = () => setSort('entropy');
el.sortScore.onclick = () => setSort('baseScore');
el.input.onkeydown = (e) => e.key === "Enter" && onAddRow(el.input.value);

document.addEventListener("DOMContentLoaded", init);

// --- Functions ---

function toggleAnswerMode() {
    activeAnswerSet = activeAnswerSet === 'answers' ? 'guesses' : 'answers';
    el.toggleBtn.textContent = `Answers: ${activeAnswerSet === 'answers' ? 'Official Set' : 'ALL Guesses'}`;
    resetAll();
}

function resetAll() {
    possibleWords = activeAnswerSet === 'answers' ? [...allAnswers] : [...allGuesses];
    el.board.innerHTML = "";
    el.avgSkill.textContent = "—";
    currentAnalysis = [];
    updateStatsAndSuggestions();
}

function onAddRow(word, analysisData = null) {
    const guess = word.trim().toLowerCase();
    if (!/^[a-z]{5}$/.test(guess)) return;
    if (!allGuesses.includes(guess)) {
        alert("Not in word list.");
        return;
    }

    const rowCont = document.createElement("div");
    rowCont.className = "row-container";

    const row = document.createElement("div");
    row.className = "row";
    row.dataset.guess = guess;

    for (let i = 0; i < 5; i++) {
        const tile = document.createElement("div");
        tile.className = "tile state-0";
        tile.textContent = guess[i].toUpperCase();
        tile.dataset.state = "0";
        tile.onclick = () => {
            let s = (parseInt(tile.dataset.state) + 1) % 3;
            tile.dataset.state = s;
            tile.className = `tile state-${s}`;
        };
        row.appendChild(tile);
    }

    rowCont.appendChild(row);

    if (analysisData) {
        const info = document.createElement("div");
        info.className = "analysis-label";
        const skillColor = analysisData.skill > 80 ? 'skill-high' : '';
        info.innerHTML = `Entropy: ${analysisData.ent.toFixed(2)}<br>Skill: <span class="${skillColor}">${analysisData.skill}%</span>`;
        rowCont.appendChild(info);
    }

    el.board.appendChild(rowCont);
    el.input.value = "";
}

function getPattern(guess, solution) {
    const g = guess.split(""), s = solution.split("");
    const pattern = [0, 0, 0, 0, 0], counts = {};
    for (let i = 0; i < 5; i++) {
        if (g[i] === s[i]) pattern[i] = 2;
        else counts[s[i]] = (counts[s[i]] || 0) + 1;
    }
    for (let i = 0; i < 5; i++) {
        if (pattern[i] === 0 && counts[g[i]] > 0) {
            pattern[i] = 1;
            counts[g[i]]--;
        }
    }
    return pattern.join("");
}

async function updateStatsAndSuggestions() {
    el.possibleCount.textContent = possibleWords.length;
    const minG = Math.ceil(Math.log2(Math.max(1, possibleWords.length)) / Math.log2(243));
    el.minGuesses.textContent = possibleWords.length <= 1 ? "Solved" : minG;
    await computeSuggestions();
}

async function computeSuggestions() {
    el.computing.classList.remove("hidden");
    await new Promise(r => setTimeout(r, 10)); // UI Breath

    const N = possibleWords.length || 1;
    
    // Simple filter to speed up suggestions
    const results = [];
    const pool = possibleWords.length < 50 ? allGuesses : allAnswers;

    // To keep it fast for browser, we only analyze a subset of best words
    const sampleSize = possibleWords.length > 500 ? 100 : pool.length;
    const testPool = pool.slice(0, sampleSize);

    for (const cand of testPool) {
        const counts = new Map();
        for (const sol of possibleWords) {
            const p = getPattern(cand, sol);
            counts.set(p, (counts.get(p) || 0) + 1);
        }
        let entropy = 0, sumSq = 0;
        for (const c of counts.values()) {
            const p = c / N;
            entropy -= p * Math.log2(p);
            sumSq += c * c;
        }
        results.push({ word: cand, entropy, expectedRemaining: sumSq / N, baseScore: 0 });
    }

    results.sort((a, b) => currentSortKey === 'entropy' ? b.entropy - a.entropy : a.expectedRemaining - b.expectedRemaining);
    renderSuggestions(results.slice(0, 10));
    el.computing.classList.add("hidden");
}

function renderSuggestions(list) {
    el.suggestions.innerHTML = "";
    if (list.length) el.expectedAfter.textContent = list[0].expectedRemaining.toFixed(1);
    list.forEach(item => {
        const li = document.createElement("li");
        li.innerHTML = `
            <div class="sugg-left">
                <span class="sugg-word">${item.word.toUpperCase()}</span>
                <span class="sugg-meta">E: ${item.entropy.toFixed(2)} | Rem: ${item.expectedRemaining.toFixed(1)}</span>
            </div>
            <button onclick="el.input.value='${item.word}'; el.input.focus();">Use</button>
        `;
        el.suggestions.appendChild(li);
    });

    // Possible words list
    if (possibleWords.length < 40 && possibleWords.length > 0) {
        el.possibleAnswersWrap.classList.remove("hidden");
        el.possibleAnswers.innerHTML = possibleWords.map(w => `<li>${w.toUpperCase()}</li>`).join("");
    } else {
        el.possibleAnswersWrap.classList.add("hidden");
    }
}

function onApplyFeedback() {
    const rows = Array.from(el.board.querySelectorAll(".row"));
    let tempPossible = activeAnswerSet === 'answers' ? [...allAnswers] : [...allGuesses];

    rows.forEach(row => {
        const guess = row.dataset.guess;
        const pattern = Array.from(row.querySelectorAll(".tile")).map(t => t.dataset.state).join("");
        tempPossible = tempPossible.filter(sol => getPattern(guess, sol) === pattern);
    });

    possibleWords = tempPossible;
    updateStatsAndSuggestions();
}

async function promptAnalyze() {
    const input = prompt("Enter your game (guesses separated by spaces):", "CRANE SLOTH");
    if (!input) return;
    const guesses = input.toLowerCase().split(/[\s,]+/).filter(w => w.length === 5);
    const target = guesses[guesses.length - 1]; // Assume last word is target

    el.board.innerHTML = "";
    possibleWords = activeAnswerSet === 'answers' ? [...allAnswers] : [...allGuesses];
    let totalSkill = 0;

    for (let i = 0; i < guesses.length; i++) {
        const guess = guesses[i];
        
        // 1. Calculate best possible entropy for current state
        const N = possibleWords.length;
        if (N === 0) break;

        // If only 1 word left, and you guess it, skill is 100%
        let skill = 0;
        let currentEnt = 0;

        if (N === 1) {
            skill = 100;
            currentEnt = 0;
        } else {
            // Find max entropy in pool
            const sample = possibleWords.slice(0, 50); // Sample for speed
            let maxEnt = 0;
            sample.forEach(w => {
                const ent = calcWordEntropy(w, possibleWords);
                if (ent > maxEnt) maxEnt = ent;
            });

            currentEnt = calcWordEntropy(guess, possibleWords);
            skill = maxEnt > 0 ? (currentEnt / maxEnt) * 100 : 100;
        }

        totalSkill += skill;
        onAddRow(guess, { ent: currentEnt, skill: Math.round(skill) });

        // Update possible words for next turn based on target
        const pattern = getPattern(guess, target);
        possibleWords = possibleWords.filter(sol => getPattern(guess, sol) === pattern);
        
        // Update tiles visually
        const lastRow = el.board.lastChild.querySelector(".row");
        const tiles = lastRow.querySelectorAll(".tile");
        pattern.split("").forEach((p, idx) => {
            tiles[idx].dataset.state = p;
            tiles[idx].className = `tile state-${p}`;
        });
    }

    el.avgSkill.textContent = Math.round(totalSkill / guesses.length) + "%";
    updateStatsAndSuggestions();
}

function calcWordEntropy(word, pool) {
    const counts = new Map();
    const N = pool.length;
    pool.forEach(sol => {
        const p = getPattern(word, sol);
        counts.set(p, (counts.get(p) || 0) + 1);
    });
    let ent = 0;
    for (const c of counts.values()) {
        const p = c / N;
        ent -= p * Math.log2(p);
    }
    return ent;
}

function setSort(key) {
    currentSortKey = key;
    el.sortExp.classList.toggle("active-sort", key === 'expectedRemaining');
    el.sortEnt.classList.toggle("active-sort", key === 'entropy');
    el.sortScore.classList.toggle("active-sort", key === 'baseScore');
    computeSuggestions();
}
