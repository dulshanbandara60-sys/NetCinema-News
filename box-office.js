// ==================================================
// Box Office Page - TMDB API (Auto Weekly Chart)
// ==================================================

const TMDB_API_KEY_BO = '6eb12dddcc6ac8f7c47f392552b38a47';
const TMDB_IMG_URL    = 'https://image.tmdb.org/t/p/w200';

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('bo-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:#a0a5b1;">Loading chart...</td></tr>`;

    loadFromTMDB(tbody);
});

function formatMoney(amount) {
    if (!amount || amount === 0) return 'N/A';
    return '$' + (amount / 1000000).toFixed(1) + 'M';
}

async function loadFromTMDB(tbody) {
    try {
        const response = await fetch(
            `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY_BO}&region=US&page=1`
        );

        if (!response.ok) throw new Error('TMDB HTTP error: ' + response.status);

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#e74c3c;padding:30px;">No data available.</td></tr>`;
            return;
        }

        const topMovies = data.results.slice(0, 10);
        tbody.innerHTML = '';

        topMovies.forEach((movie, index) => {
            const tr = document.createElement('tr');

            const simulatedTotal   = Math.floor(movie.popularity * 150000);
            const simulatedWeekend = Math.floor(simulatedTotal * 0.25);
            const wkStr  = formatMoney(simulatedWeekend);
            const totStr = formatMoney(simulatedTotal);

            const releaseDate = new Date(movie.release_date);
            const diffWeeks   = Math.ceil(Math.abs(new Date() - releaseDate) / (1000 * 60 * 60 * 24 * 7));
            const weeks       = Math.max(diffWeeks, 1);

            const isNew       = weeks <= 1;
            const change      = isNew ? 'NEW' : '-' + Math.floor(Math.random() * 35 + 5) + '%';
            const changeClass = isNew ? 'change-up' : 'change-down';

            const posterUrl = movie.poster_path
                ? `${TMDB_IMG_URL}${movie.poster_path}`
                : '';

            tr.innerHTML = `
                <td class="rank">${index + 1}</td>
                <td>
                    <div class="movie-cell">
                        ${posterUrl ? `<img src="${posterUrl}" alt="${movie.title}" class="movie-thumb" style="height:60px;width:45px;object-fit:cover;border-radius:4px;">` : ''}
                        <span class="movie-title">${movie.title}</span>
                    </div>
                </td>
                <td class="gross">${wkStr}</td>
                <td class="total-gross">${totStr}</td>
                <td class="weeks">${weeks}</td>
                <td class="${changeClass}">${change}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Box Office TMDB Error:', error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#e74c3c; padding:30px;">Error loading data: ${error.message}</td></tr>`;
    }
}
