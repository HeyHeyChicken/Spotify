class Client {
    constructor(_main) {
        const SELF = this;

        this.Main = _main;

        // Sockets from client
        this.Main.IOServer.on("connection", function(socket){
            socket.on("get_spotify_token", function(){
                SELF.Main.IOClient.emit("get_spotify_token");
            });
            socket.on("set_spotify_device", function(_name){
                SELF.Main.IOClient.emit("set_spotify_device", _name);
            });
        });

        // Sockets from server
        this.Main.IOClient.on("set_spotify_token", function(_token, _autoplay){
            SELF.Main.IOServer.sockets.emit("set_spotify_token", _token, _autoplay);
        });
        this.Main.IOClient.on("set_spotify_next", function(){
            SELF.Main.IOServer.sockets.emit("set_spotify_next");
        });
        this.Main.IOClient.on("set_spotify_previous", function(){
            SELF.Main.IOServer.sockets.emit("set_spotify_previous");
        });
        this.Main.IOClient.on("set_spotify_pause", function(){
            SELF.Main.IOServer.sockets.emit("set_spotify_pause");
        });
    }
}

module.exports = Client;