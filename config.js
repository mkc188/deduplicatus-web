module.exports = {
    "HTTPS": process.env.HTTPS_ENABLE || false,
    "PORT": process.env.PORT || 3000,
    "USER_DATA": __dirname + "/users_data",
    "REDIS_SOCKET": process.env.REDIS_SOCKET || "/tmp/redis-deduplicatus.sock",
    "CHUNKS_FOLDER": ".deduplicatus",

    "DBURI": process.env.DB_CREDENTIAL,
    "SESSION_SECRET": process.env.SESSION_SECRET,
    "DROPBOX": {
        "KEY": process.env.DROPBOX_KEY,
        "SECRET": process.env.DROPBOX_SECRET
    },
    "MSAPI": {
        "KEY": process.env.MSAPI_KEY,
        "SECRET": process.env.MSAPI_SECRET
    },
    "BOXDOTNET": {
        "KEY": process.env.BOXDOTNET_KEY,
        "SECRET": process.env.BOXDOTNET_SECRET,
    }
};
