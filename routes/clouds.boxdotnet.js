var querystring = require('querystring'),
    Promise = require('promise'),
    rp = require('request-promise');

module.exports = function(config) {
    var boxdotnet = {};

    boxdotnet.type = 'boxdotnet';

    // return oauth path for redirection to user
    boxdotnet.oauthAuthorizeUri = function(redirectUri, csrfToken) {
        var query = {
            response_type: 'code',
            client_id: config.BOXDOTNET.KEY,
            redirect_uri: redirectUri,
            state: csrfToken
        }

        return 'https://app.box.com/api/oauth2/authorize?' + querystring.stringify(query);        
    }

    // handle oauth code callback
    boxdotnet.oauthCallback = function(session, query) {
        if( session.oauthCSRF != query.state ) {
            console.log('csrf')
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
            uri: 'https://app.box.com/api/oauth2/token',
            method: 'POST',
            body: querystring.stringify({
                code: query.code,
                grant_type: 'authorization_code',
                client_id: config.BOXDOTNET.KEY,
                client_secret: config.BOXDOTNET.SECRET,
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
                        type: boxdotnet.type,
                        accessToken: response.access_token,
                        refreshToken: response.refresh_token
                    }

                    // get account info
                    var options = {
                        uri: 'https://api.box.com/2.0/users/me',
                        method: 'GET',
                        headers: {
                            'Authorization': 'Bearer ' + metadata.accessToken
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
                    metadata.accountName = response.name;
                    metadata.cloudIdentifier = response['id'];

                    // find .deduplicatus folder's id if exists.
                    // otherwise will create a folder and return it's id.
                    var options = {
                        uri: 'https://api.box.com/2.0/folders/0/items',
                        method: 'GET',
                        headers: {
                            'Authorization': 'Bearer ' + metadata.accessToken
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

                    for( var i = 0; i < response['entries'].length; i++ ) {
                        var item = response['entries'][i];

                        if( item['type'] == 'folder' && item['name'] == config.CHUNKS_FOLDER ) {
                            metadata.folderId = item['id'];
                            return new Promise(function(resolve, reject) {
                                resolve(null);
                            });
                        }
                    }

                    // folder not found, create an new one and return it's id
                    var options = {
                        uri: 'https://api.box.com/2.0/folders',
                        method: 'POST',
                        body: JSON.stringify({
                            name: config.CHUNKS_FOLDER,
                            parent: {
                                "id": "0"
                            }
                        }),
                        headers: {
                            'Authorization': 'Bearer ' + metadata.accessToken,
                            'Content-Type': 'application/json'
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

                    if( typeof metadata.folderId == 'undefined' ) {
                        if( parseInt(response['id']) > 0 ) {
                            metadata.folderId = response['id'];
                        } else {
                            return null;
                        }
                    }

                    return metadata;
                },
                function(error) {
                    return null;
                }
            );
    }

    return boxdotnet;
};
