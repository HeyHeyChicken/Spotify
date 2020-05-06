const LIBRARIES = {
  Path: require("path"),
  Express: require("express"),
  FS: require("fs"),
  HTTPS: require("https"),
  QueryString: require("querystring"),
  Skill: require("../../../Libraries/Skill")
};

class Spotify extends LIBRARIES.Skill {
  constructor(_main, _settings) {
    super(_main, _settings);
    const SELF = this;

    this.Main.Manager.addAction("Spotify.music.pause", function(_intent, _socket){
      _socket.emit("set_spotify_pause");
    });

    this.Main.Manager.addAction("Spotify.music.play", function(_intent, _socket){
      SELF.RefreshToken(_socket, true);
    });

    this.Main.Manager.addAction("Spotify.music.next", function(_intent, _socket){
      _socket.emit("set_spotify_next");
    });

    this.Main.Manager.addAction("Spotify.music.previous", function(_intent, _socket){
      _socket.emit("set_spotify_previous");
    });

    this.Main.ClientIO.on("connection", function(socket){
      // L'utilisateur demande son token
      socket.on("get_spotify_token", function() {
        SELF.RefreshToken(socket, false);
      });
      socket.on("set_spotify_device", function(_name) {
        SELF.SetDevice(_name, socket);
      });
    });

    const PAGE = "spotify_set_code";
    this.Main.Express.use("/Spotify", LIBRARIES.Express.static(LIBRARIES.Path.join(__dirname, "/public")));
    this.Main.Express.get("/" + PAGE, function(req, res){
      res.status(200).send("Good !<br/>1) You can close this tab.<br/>2) You can click to the power button again.");
      SELF.SetCode(req.query.code);
    });
  }

  /* #################################################################################### */
  /* ### FUNCTIONS ###################################################################### */
  /* #################################################################################### */

  SetCode(_code){
    this.Settings.Code = _code
    this.Main.Log(__dirname, "red");
    const FILE_PATH = LIBRARIES.Path.join(__dirname, "/settings.json");

    const CURRENT = JSON.parse(LIBRARIES.FS.readFileSync(FILE_PATH, "utf8"));
    CURRENT.Settings = this.Settings;
    LIBRARIES.FS.writeFileSync(FILE_PATH, JSON.stringify(CURRENT), "utf8");

    this.GetTokensFromCode();
  }

  GetTokensFromCode(){
    const SELF = this;

    const BODY = LIBRARIES.QueryString.stringify({
      "grant_type": "authorization_code",
      "code": this.Settings.Code,
      "redirect_uri": "http://localhost:8080/spotify_set_code",
      "client_id": this.Settings.AppPublicID,
      "client_secret": this.Settings.AppSecretID
    });

    const OPTIONS = {
      hostname: "accounts.spotify.com",
      port: 443,
      path: "/api/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": BODY.length
      }
    }

    let result = "";

    const req = LIBRARIES.HTTPS.request(OPTIONS, res => {
      res.on("data", d => {
        result += d;
      })
      res.on("end", () => {
        result = JSON.parse(result);
        SELF.Settings.AccessToken = result.access_token;
        SELF.Settings.RefreshToken = result.refresh_token;
        SELF.Settings.Code = null;

        const FILE_PATH = LIBRARIES.Path.join(__dirname, "/settings.json");

        const CURRENT = JSON.parse(LIBRARIES.FS.readFileSync(FILE_PATH, "utf8"));
        CURRENT.Settings = this.Settings;
        LIBRARIES.FS.writeFileSync(FILE_PATH, JSON.stringify(CURRENT), "utf8");
      });
    })

    req.on("error", error => {
      console.error(error);
    })

    req.write(BODY);
    req.end();
  }

  RefreshToken(_socket, _autoplay){
    const SELF = this;

    if(this.Settings.Code === null && (this.Settings.RefreshToken === null || this.Settings.RefreshToken === undefined)) {
      const PAGE = "spotify_set_code";

      // user-read-playback-state Endpoint
      const scopes = encodeURIComponent("ugc-image-upload user-follow-read user-follow-modify user-read-recently-played user-top-read user-read-playback-position user-library-read user-library-modify user-read-playback-state user-read-currently-playing user-modify-playback-state playlist-read-collaborative playlist-modify-private playlist-modify-public playlist-read-private streaming app-remote-control user-read-email user-read-private");
      const redirect = encodeURIComponent("http://localhost:8080/" + PAGE);
      if(_socket !== undefined){
        _socket.emit("open", "https://accounts.spotify.com/authorize?response_type=code&client_id=" + this.Settings.AppPublicID + "&scope=" + scopes + "&redirect_uri=" + redirect);
      }
    }
    else{
      const BODY = LIBRARIES.QueryString.stringify({
        "grant_type": "refresh_token",
        "refresh_token": this.Settings.RefreshToken,
        "client_id": this.Settings.AppPublicID,
        "client_secret": this.Settings.AppSecretID
      });

      const OPTIONS = {
        hostname: "accounts.spotify.com",
        port: 443,
        path: "/api/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": BODY.length
        }
      }

      let result = "";

      const req = LIBRARIES.HTTPS.request(OPTIONS, res => {
        res.on("data", d => {
          result += d;
        })
        res.on("end", () => {
          result = JSON.parse(result);
          SELF.Settings.AccessToken = result.access_token;

          const FILE_PATH = LIBRARIES.Path.join(__dirname, "/settings.json");

          const CURRENT = JSON.parse(LIBRARIES.FS.readFileSync(FILE_PATH, "utf8"));
          CURRENT.Settings = this.Settings;
          LIBRARIES.FS.writeFileSync(FILE_PATH, JSON.stringify(CURRENT), "utf8");
          if(_socket != undefined){
            _socket.emit("set_spotify_token", result.access_token, _autoplay);
          }
        });
      })

      req.on("error", error => {
        console.error(error);
      })

      req.write(BODY);
      req.end();
    }
  }

  GetDevices(_callback){
    const SELF = this;

    const OPTIONS = {
      hostname: "api.spotify.com",
      port: 443,
      path: "/v1/me/player/devices",
      method: "GET",
      headers: {
        "Authorization": "Bearer " + this.Settings.AccessToken
      }
    }

    let result = "";

    const req = LIBRARIES.HTTPS.request(OPTIONS, res => {
      res.on("data", d => {
        result += d;
      })
      res.on("end", () => {
        result = JSON.parse(result);
        if(_callback !== undefined){
          _callback(result.devices);
        }
      });
    })

    req.on("error", error => {
      console.error(error);
    })

    req.end();
  }

  SetDevice(_name, _socket){
    const SELF = this;

    SELF.GetDevices(function(_devices){
      const DEVICE = _devices.find(x => x.name == _name);

      const BODY = JSON.stringify({
        "device_ids": [DEVICE.id]
      });

      const OPTIONS = {
        hostname: "api.spotify.com",
        port: 443,
        path: "/v1/me/player",
        method: "PUT",
        headers: {
          "Authorization": "Bearer " + SELF.Settings.AccessToken
        }
      }

      let result = "";

      const req = LIBRARIES.HTTPS.request(OPTIONS, res => {
        res.on("data", d => {
          result += d;
        })
        res.on("end", () => {
          if(res.statusCode === 204){
            _socket.emit("spotify_ready_to_play");
          }
        });
      })

      req.on("error", error => {
        console.error(error);
      })

      req.write(BODY);
      req.end();
    });
  }
}

module.exports = Spotify;
