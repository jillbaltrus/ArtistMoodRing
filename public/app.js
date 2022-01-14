// config contains API credentials
const config = require('../config.js');

const APIController = (function() {
    
    const clientId = config.config.CLIENT_ID;
    const clientSecret = config.config.CLIENT_SECRET;

    // get API token (needed for other API calls)
    const _getToken = async () => {

        const result = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type' : 'application/x-www-form-urlencoded', 
                'Authorization' : 'Basic ' + btoa(clientId + ':' + clientSecret)
            },
            body: 'grant_type=client_credentials'
        });

        const data = await result.json();
        return data.access_token;
    }

    // get artist based off user search
    const _getArtistSearch = async (token, name) => {
        
        const result = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`, {
            method: 'GET',
            headers: { 'Authorization' : 'Bearer ' + token}
        });

        const data = await result.json();
        return data.artists.items;
    }

    // get top tracks based off artist ID
    const _getArtistTopTracks= async (token, artistId) => {
        
        const result = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?limit=100&market=us`, {
            method: 'GET',
            headers: { 'Authorization' : 'Bearer ' + token}
        });

        const data = await result.json();
        return data.tracks;
    }

    // gets tracks' features from track IDs
    const _getTracksFeatures= async (token, trackIds) => {
        
        const result = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds}`, {
            method: 'GET',
            headers: { 'Authorization' : 'Bearer ' + token}
        });

        const data = await result.json();
        return data.audio_features;
    }

    // wrappers
    return {
        getToken() {
            return _getToken();
        },
        getArtistSearch(token, name) {
            return _getArtistSearch(token, name);
        },
        getArtistTopTracks(token, artistId) {
            return _getArtistTopTracks(token, artistId);
        },
        getTracksFeatures(token, trackIds) {
            return _getTracksFeatures(token, trackIds);
        }
    }
})();


const UIController = (function() {

    // map of references to html selectors (uses IDs)
    const Selectors = {
        hfToken: '#hidden_token',
        artistName: '#artistName',
        buttonSearch: '#searchArtist',
        alert: '#alert',
        errorMsg: '#errorMsg',
        danceability: '#danceability',
        euphoria: '#euphoria',
        intensity: '#intensity',
        acousticness: '#acousticness',
        resultsContainer: '#results-container',
        resultsTitle: '#results-title',
    }

    return {

        // get DOM element fromm selector
        Elements() {
            return {
                artist: document.querySelector(Selectors.artistName),
                search: document.querySelector(Selectors.buttonSearch),
                alert: document.querySelector(Selectors.alert),
                errorMsg: document.querySelector(Selectors.errorMsg),
                danceabilityReport: document.querySelector(Selectors.danceability),
                euphoriaReport: document.querySelector(Selectors.euphoria),
                intensityReport: document.querySelector(Selectors.intensity),
                acousticnessReport: document.querySelector(Selectors.acousticness),
                resultsContainer: document.querySelector(Selectors.resultsContainer),
                resultsTitle: document.querySelector(Selectors.resultsTitle),
            }
        },

        // if valid string is entered in search bar, enable search button
        handleKey() {
            const empty = this.Elements().artist.value.trim() === '';
            if (empty) {
                this.Elements().search.disabled = true;
            } else {
                this.Elements().search.disabled = false;
            }
        },

        // display track info based off API scores
        analyzeTracks(danceability, energy, euphoric, acousticness, name) {
            const opacityMin = 0.3;
            this.Elements().resultsTitle.innerHTML = `${name}'s mood ring:`;
            this.Elements().danceabilityReport.innerHTML = 
                `<h5 style="opacity:${Math.max(opacityMin, danceability)}">Danceability: ${Math.round(danceability * 100)}%</h5>`;

            this.Elements().intensityReport.innerHTML =
                `<h5 style="opacity:${Math.max(opacityMin, energy)}">Intensity: ${Math.round(energy * 100)}%</h5>`;

            this.Elements().euphoriaReport.innerHTML =
                `<h5 style=\"opacity:${Math.max(opacityMin, euphoric)}\">Euphoria: ${Math.round(euphoric * 100)}%</h5>`;

            this.Elements().acousticnessReport.innerHTML =
                `<h5 style="opacity:${Math.max(opacityMin, acousticness)}">Acousticness: ${Math.round(acousticness * 100)}%</h5>`;

            this.Elements().resultsContainer.hidden = false;
        },

        // show error if no artist was found
        displayError(msg) {
            // clear previous error message
            this.Elements().resultsContainer.hidden = true;
            this.Elements().errorMsg.innerHTML = msg;
            this.Elements().alert.hidden = false;
        },

        // hide error
        clearError() {
            this.Elements().alert.hidden = true;
        },

        // empty search bar and disable search button
        resetSearch() {
            this.Elements().artist.value = '';
            this.Elements().search.disabled = true;
        },

        // insert token into html
        storeToken(value) {
            document.querySelector(Selectors.hfToken).value = value;
        },

        // get token from html
        getStoredToken() {
            return {
                token: document.querySelector(Selectors.hfToken).value
            }
        }
    }

})();

const APPController = (function(UICtrl, APICtrl) {

    // get references to DOM elements
    const DOMInputs = UICtrl.Elements();

    // if key is pressed, signal to UI contonrol
    DOMInputs.artist.addEventListener('keyup', () => UICtrl.handleKey());

    // if search is clicked, make API calls to get data and display it on UI (or display error)
    DOMInputs.search.addEventListener('click', async (e) => {
        e.preventDefault();
        UICtrl.clearError();
        // TODO: reset mood analysis info
        // get token
        const token = UICtrl.getStoredToken().token;
        // get the artist name field
        const searchedArtist = UICtrl.Elements().artist.value;
        // throw error if empty
        // or, search artist button is disabled until text is entered
        const artist = await APICtrl.getArtistSearch(token, searchedArtist);
        if (artist.length === 0) {
            UICtrl.displayError(`Sorry, we couldn't find an artist named ${searchedArtist}. Please try a new search.`)
            // error message
        } else {
            const artistFullName = artist[0].name;
            const topTracks = await APICtrl.getArtistTopTracks(token, artist[0].id);
            const ids = topTracks.map(t => t.id).join();
            const tracksFeatures = await APICtrl.getTracksFeatures(token, ids);
            const avgAsPercent = array => (array.reduce((x, y) => x + y) / array.length);
            UICtrl.analyzeTracks(avgAsPercent(tracksFeatures.map(t => t.danceability)),
                avgAsPercent(tracksFeatures.map(t => t.energy)),
                avgAsPercent(tracksFeatures.map(t => t.valence)),
                avgAsPercent(tracksFeatures.map(t => t.acousticness)),
                artistFullName);

        }
        UICtrl.resetSearch();
    });

    // token control
    return {
        async init() {
            //get the token
            const token = await APICtrl.getToken();           
            //store the token onto the page
            UICtrl.storeToken(token);
        }
    }

})(UIController, APIController);

// will need to call a method to load the genres on page load
APPController.init();




