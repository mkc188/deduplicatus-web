var querystring = require('querystring'),
    Promise = require('promise'),
    rp = require('request-promise'),
    google = require('googleapis'),
    OAuth2 = google.auth.OAuth2,
    plus = google.plus('v1');

module.exports = function(config) {
    var googledrive = {};

    googledrive.type = 'googledrive';

    // return oauth path for redirection to user
    googledrive.oauthAuthorizeUri = function(redirectUri, csrfToken) {
        var oauth2Client = new OAuth2(config.GOOGLEAPI.KEY, config.GOOGLEAPI.SECRET, redirectUri);

        var scopes = [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/plus.me'
        ];

        return url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            approval_prompt: 'force'
        });       
    }

    // handle oauth code callback
    googledrive.oauthCallback = function(session, query) {
        return new Promise(function(resolve, reject) {
            var oauth2Client = new OAuth2(config.GOOGLEAPI.KEY, config.GOOGLEAPI.SECRET, session.redirectUri);

            if( typeof query.code == "undefined" ) {
                return reject(null);
            }

            oauth2Client.getToken(query.code, function(err, tokens) {
                if( err ) {
                    return reject(null);
                }

                oauth2Client.setCredentials({
                    access_token: tokens.access_token
                });

                plus.people.get({ userId: 'me', auth: oauth2Client }, function(err, response) {
                    var metadata = {
                        type: googledrive.type,
                        accessToken: tokens.access_token,
                        refreshToken: (typeof tokens.refresh_token != "undefined") ? tokens.refresh_token : false,
                        cloudIdentifier: response['id'],
                        accountName: response.displayName
                    }

                    return resolve(metadata);
                });

            });
        });
    }

    return googledrive;
};
