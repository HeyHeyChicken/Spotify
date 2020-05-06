const SPOTIFY_COMPONENT = Vue.component("novaspotify", {
    data() {
        return{
            playing: false,
            name: null,
            artists: null,
            img: null,
            wallpaper: null,
            token: null,
            initialised: false,
            autoplay: false
        }
    },
    methods: {
        power: function(event){
            MAIN.Socket.emit("get_spotify_token");
        },
        toggle: function(event){
            this.playing = !this.playing;
            SpotifyPlayer.togglePlay();
        },
        next: function(event){
            SpotifyPlayer.nextTrack();
        },
        previous: function(event){
            SpotifyPlayer.previousTrack();
        }
    },
    template: ''+
        '<div class="col col-12 col-sm-10 col-md-8 col-lg-6">'+
            '<div class="spotify">'+
                '<div class="wallpaper"><div :style="{ backgroundImage: \'url(\' + wallpaper + \')\' }"></div></div>'+
                '<div class="img" :style="{ backgroundImage: \'url(\' + img + \')\' }"></div>'+
                '<div class="controls">'+
                    '<div :title="name" class="name">{{name}}</div>'+
                    '<div :title="artists" class="artist">{{artists}}</div>'+
                    //'<input type="range" min="0" max="100">'+
                    '<button v-show="!initialised" @click="power">'+
                        '<i class="fas fa-power-off"></i>'+
                    '</button>'+
                    '<table v-show="initialised">'+
                        '<tbody>'+
                            '<tr>'+
                                '<td>'+
                                    '<button @click="previous">'+
                                        '<i class="fas fa-step-backward"></i>'+
                                    '</button>'+
                                '</td>'+
                                '<td>'+
                                    '<button @click="toggle">'+
                                        '<div v-show="!playing">'+
                                            '<i class="fas fa-play"></i>'+
                                        '</div>'+
                                        '<div v-show="playing">'+
                                            '<i class="fas fa-pause"></i>'+
                                        '</div>'+
                                    '</button>'+
                                '</td>'+
                                '<td>'+
                                    '<button @click="next">'+
                                        '<i class="fas fa-step-forward"></i>'+
                                    '</button>'+
                                '</td>'+
                            '</tr>'+
                        '</tbody>'+
                    '</table>'+
                '</div>'+
            '</div>'+
        '</div>'
});

const DIV = document.createElement("novaspotify");
const ID = "spotify";
DIV.setAttribute("id", ID);
document.getElementById("tab-dashboard").getElementsByClassName("row")[0].appendChild(DIV);

MAIN.Volume.Subscriptions.push(function(_volume){
    if(SpotifyPlayer !== null){
        SpotifyPlayer.setVolume(_volume.Value / 100);
    }
});

let SpotifyApp = new Vue({
    el: "#" + ID
});
SpotifyApp.$children[0].img = MAIN.App.server.url + "/HeyHeyChicken_NOVA-Spotify/img/spotify.jpg"

let SpotifyPlayer = null;

/* ############################################################################################ */
/* ### SOCKETS ################################################################################ */
/* ############################################################################################ */

MAIN.Socket.on("set_spotify_token", function(_token, _autoplay) {
    SpotifyApp.$children[0].token = _token;
    SpotifyApp.$children[0].autoplay = _autoplay;
    InitSpotify();
});

MAIN.Socket.on("spotify_ready_to_play", function() {
    if(!SpotifyApp.$children[0].playing){
        SpotifyPlayer.resume();
    }
});

MAIN.Socket.on("set_spotify_next", function() {
    SpotifyPlayer.nextTrack();
});

MAIN.Socket.on("set_spotify_previous", function() {
    SpotifyPlayer.previousTrack();
});

MAIN.Socket.on("set_spotify_pause", function() {
    SpotifyPlayer.pause();
});

/* ############################################################################################ */
/* ### FUNCTIONS ############################################################################## */
/* ############################################################################################ */

function InitSpotify(){
    const NAME = "Nova";
    SpotifyPlayer = new Spotify.Player({
        name: NAME,
        getOAuthToken: cb => { cb(SpotifyApp.$children[0].token); },
        volume: MAIN.Volume.Value / 100
    });

    // Error handling
    SpotifyPlayer.addListener('initialization_error', ({ message }) => { console.error(message); });
    SpotifyPlayer.addListener('authentication_error', ({ message }) => { console.error(message); });
    SpotifyPlayer.addListener('account_error', ({ message }) => { console.error(message); });
    SpotifyPlayer.addListener('playback_error', ({ message }) => { console.error(message); });

    // Playback status updates
    SpotifyPlayer.addListener('player_state_changed', state => {
        console.log("player_state_changed", state);
        SpotifyApp.$children[0].initialised = true;
        SpotifyApp.$children[0].playing = !state.paused;
        SpotifyApp.$children[0].img = state.track_window.current_track.album.images[0].url;
        SpotifyApp.$children[0].wallpaper = state.track_window.current_track.album.images[0].url;
        SpotifyApp.$children[0].name = state.track_window.current_track.name;
        SpotifyApp.$children[0].artists = state.track_window.current_track.artists.map(function(x){
            return x.name;
        }).join(", ");

        if(SpotifyApp.$children[0].autoplay === true && state.paused === true){
            SpotifyApp.$children[0].autoplay = false;

            setTimeout(function(){
                SpotifyPlayer.resume();
            }, 1000);
        }
    });

    // Ready
    SpotifyPlayer.addListener("ready", ({ device_id }) => {
        MAIN.Socket.emit("set_spotify_device", NAME);
        console.log("ready", device_id);
    });

    // Not Ready
    SpotifyPlayer.addListener("not_ready", ({ device_id }) => {
        SpotifyApp.$children[0].initialised = false;
        console.log('Device ID has gone offline', device_id);
    });

    SpotifyPlayer.connect(); // Connect to the player!
}