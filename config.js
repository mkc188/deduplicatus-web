module.exports = {
    "DBURI": process.env.DB_CREDENTIAL || "mysql://deduplicatus:UH8UwWQ4zPSez7nQ@localhost/deduplicatus",
    "PORT": process.env.PORT || 3000,
    "SESSION_SECRET": process.env.SESSION_SECRET || "BXkmowDnZXfjyfJp5uzAaONFDLgFr4wh",
    "USER_DATA": __dirname + "/users_data"
};
