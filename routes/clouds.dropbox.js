var querystring = require('querystring'),
    Promise = require('promise'),
    rp = require('request-promise');

module.exports = function(config) {
    var dropbox = {};

    dropbox.type = 'dropbox';

    // return oauth path for redirection to user
    dropbox.oauthAuthorizeUri = function(redirectUri, csrfToken) {
        var query = {
            response_type: 'code',
            client_id: config.DROPBOX.KEY,
            redirect_uri: redirectUri,
            state: csrfToken
        }

        return 'https://www.dropbox.com/1/oauth2/authorize?' + querystring.stringify(query);        
    }

    // handle oauth code callback
    dropbox.oauthCallback = function(session, query) {
        if( session.oauthCSRF != query.state ) {
            return new Promise(function(resolve, reject) {
                return reject(null);
            });
        }

        if( typeof query.error != "undefined" ) {
            return new Promise(function(resolve, reject) {
                return reject({
                    error: query.error,
                    description: query.error_description,
                });
            });
        }

        var options = {
            uri: 'https://api.dropbox.com/1/oauth2/token',
            method: 'POST',
            body: querystring.stringify({
                code: query.code,
                grant_type: 'authorization_code',
                client_id: config.DROPBOX.KEY,
                client_secret: config.DROPBOX.SECRET,
                redirect_uri: session.redirectUri
            }),
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        var metadata;
        return rp(options)
            .then(
                function(response) {
                    response = JSON.parse(response);

                    metadata = {
                        type: dropbox.type,
                        accessToken: response.access_token,
                        refreshToken: false,
                        cloudIdentifier: response.uid
                    }

                    // get account info
                    var options = {
                        uri: 'https://api.dropbox.com/1/account/info',
                        method: 'GET',
                        headers: {
                          'Authorization': 'Bearer ' + response.access_token
                        }
                    };

                    return rp(options);
                },
                function(error) {
                    return null;
                }
            )
            .then(
                function(response) {
                    response = JSON.parse(response);
                    metadata.accountName = response.display_name;

                    return metadata;
                },
                function(error) {
                    return null;
                }
            );
    }

    return dropbox;
};