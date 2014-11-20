<?php

class Auth {
    public $uid = 0;
    public $username;
    public $ajax_token;
    private $session_key;
    private $encryption_key;

    /*
     * Constructor
     */
    public function __construct() {
        global $_CONF;

        $has_essential_cookies = (
            !empty($this->getCookie($_CONF['cookie_prefix'])) &&
            !empty($this->getCookie($_CONF['cookie_prefix'] . '_iv')) &&
            !empty($this->getCookie($_CONF['cookie_prefix'] . '_ekey')) &&
            !(strlen($this->getCookie($_CONF['cookie_prefix'])) % 2) &&
            !(strlen($this->getCookie($_CONF['cookie_prefix'] . '_iv')) % 2) &&
            !(strlen($this->getCookie($_CONF['cookie_prefix'] . '_ekey')) % 2)
            );

        if( $has_essential_cookies ) {
            $key = hex2bin(md5($_CONF['cookie_aes_key']));
            $iv  = hex2bin($this->getCookie($_CONF['cookie_prefix'] . '_iv'));

            // try to decrypt session info
            $encrypted_info = $this->getCookie($_CONF['cookie_prefix']);
            $cookie_info    = rtrim(mcrypt_decrypt(MCRYPT_RIJNDAEL_128, $key, hex2bin($encrypted_info), MCRYPT_MODE_CBC, $iv));

            list($cookie_uid, $cookie_key) = explode('|', $cookie_info);

            // search for specific user id and session key
            $session = DB::queryFirstRow(
                "SELECT s.*, u.username FROM `sessions` as s, `users` as u WHERE s.`key` = %s AND s.`uid` = %i AND u.`id` = s.`uid`",
                $cookie_key,
                $cookie_uid
                );
            if( !empty($session) && $session['value'] == $this->getCookie($session['key']) ) {

                // token in cookie is valid, user is signed on
                $this->uid         = intval($session['uid']);
                $this->username    = $session['username'];
                $this->ajax_token  = $session['ajax_token'];
                $this->session_key = $session['key'];

                // decrypt the encryption key in sessions table
                $ekey_key = $this->getCookie($_CONF['cookie_prefix'] . '_ekey');
                $this->encryption_key = rtrim(
                    mcrypt_decrypt(
                        MCRYPT_RIJNDAEL_256,
                        hex2bin($ekey_key),
                        hex2bin($session['key_ct']),
                        MCRYPT_MODE_CBC,
                        hex2bin($session['key_iv'])),
                    "\0..\32");

                $time = time();

                // if the cookie expiry time is near, extends the session
                if( $session['time'] < $time + 3600 ) {
                    $extended_time = $time + $_CONF['cookie_time'];

                    DB::update('sessions', array(
                        'time' => $extended_time,
                    ), "`key` = %s AND `uid` = %i", $session['key'], $session['uid']);

                    setcookie($_CONF['app_identifier'], $this->getCookie($_CONF['cookie_prefix']), $extended_time, "/");
                    setcookie($_CONF['app_identifier'] . '_iv', $this->getCookie($_CONF['cookie_prefix'] . '_iv'), $extended_time, "/");
                    setcookie($_CONF['app_identifier'] . '_ekey', $this->getCookie($_CONF['cookie_prefix'] . '_ekey'), $extended_time, "/");
                    setcookie($session['key'], $this->getCookie($session['key']), $extended_time, "/");
                }
            }
        }
    }


    /*
     * Valid user or not
     *
     * @return boolean
     */
    public function valid() {
        return ( $this->uid != 0 );
    }


    /*
     * Return session AES key for encrypt/decrypt signon and register request,
     * create new key if no previous key found
     *
     * @return string
     */
    public function getAESKey() {
        if( empty($_SESSION['auth_aes_key']) ) {
            // use /dev/urandom to generate IV and use as AES key
            $key = mcrypt_create_iv(128/8, MCRYPT_DEV_URANDOM);

            // save in current session
            $_SESSION['auth_aes_key'] = bin2hex($key);
        }

        return $_SESSION['auth_aes_key'];
    }


    /*
     * Decrypt the raw request which is encrypted using Session AES key
     *
     * @param string raw data
     * @return string original JSON / bool false
     */
    public function decryptRequest($raw_data) {
        $json        = json_decode($raw_data);
        $isJSONValid = ( json_last_error() == JSON_ERROR_NONE );

        if( $isJSONValid ) {
            // prepare all value to decrypt the request
            $ciphertext = ( !empty($json->ct) ) ? base64_decode($json->ct) : '';
            $iv         = ( !empty($json->iv) ) ? base64_decode($json->iv) : '';
            $key        = $this->getAESKey();

            // check if all value is not empty
            $isDecryptable = ( !empty($key) && !empty($ciphertext) && !empty($iv) );

            // decrypt the password and query the database
            if( $isDecryptable ) {
                return rtrim(mcrypt_decrypt(MCRYPT_RIJNDAEL_128, hex2bin($key), $ciphertext, MCRYPT_MODE_CBC, $iv), "\0..\32");
            }
        }

        return false;
    }


    /*
     * Add user to database and return register status
     *
     * @param string username
     * @param string password
     * @param string email
     * @param string name
     * @return string
     */
    public function register($raw_data) {
        global $_CONF;

        if( !$this->valid() ) {
            $json         = $this->decryptRequest($raw_data);
            $json         = ( !empty($json) ) ? json_decode($json) : false;
            $isJSONValid  = ( !empty($json) && json_last_error() == JSON_ERROR_NONE );

            // ignore request if raw data is not json decodable
            if( $isJSONValid ) {
                $username = ( !empty($json->username) ) ? $json->username : '';
                $password = ( !empty($json->password) ) ? $json->password : '';
                $email    = ( !empty($json->email) ) ? $json->email : '';

                // field check
                if( empty($username) || empty($password) || empty($email) || strlen($password) < 8 ) {
                    return REGISTER_FIELD_INCOMPLETE;
                }

                $user_count  = DB::queryOneField('user_count', "SELECT COUNT(id) as user_count FROM `users` WHERE `username` = %s", $username);
                $email_count = DB::queryOneField('email_count', "SELECT COUNT(id) as email_count FROM `users` WHERE `email` = %s", $email);
                if( intval($user_count) ) {
                    return REGISTER_USER_EXITS;
                }
                if( intval($email_count) ) {
                    return REGISTER_EMAIL_EXITS;
                }

                // hash user's password
                $hashed_pass = password_hash($password, PASSWORD_DEFAULT);

                // create user's encryption key for all metafiles
                $ekey = bin2hex(mcrypt_create_iv(256/8, MCRYPT_DEV_URANDOM));

                // encrypt the key with user's password
                $key       = hash("sha256", $password, true);
                $iv        = mcrypt_create_iv(256/8, MCRYPT_DEV_URANDOM);
                $encrypted = bin2hex(mcrypt_encrypt(MCRYPT_RIJNDAEL_256, $key, $ekey, MCRYPT_MODE_CBC, $iv));

                // insert to database
                DB::query(
                    "INSERT INTO `users` (`id`, `username`, `password`, `email`, `key_ct`, `key_iv`) VALUES ('NULL', %s, %s, %s, %s, %s);",
                    $username,
                    $hashed_pass,
                    $email,
                    $encrypted,
                    bin2hex($iv)
                    );

                return REGISTER_SUCCESS;  
            }
        }

        // there are three possible cases to reach here:
        //  1. user is already signed in
        //  2. request json is not decodable
        return REGISTER_REFRESH_SESSION;
    }


    /*
     * Sign in
     *
     * @param string raw data
     * @return boolean
     */
    public function signIn($raw_data) {
        global $_CONF;

        if( $this->valid() ) {
            // sign out the current session
            $this->signOut();
        }

        $json         = $this->decryptRequest($raw_data);
        $json         = ( !empty($json) ) ? json_decode($json) : false;
        $isJSONValid  = ( !empty($json) && json_last_error() == JSON_ERROR_NONE );

        // ignore request if raw data is not json decodable
        if( $isJSONValid ) {
            $name = ( !empty($json->username) ) ? $json->username : '';
            $pass = ( !empty($json->password) ) ? $json->password : '';

            // query database for specific user 
            $user = DB::queryFirstRow("SELECT `id`, `username`, `password`, `key_ct`, `key_iv` FROM `users` WHERE `username` = %s", $name);
            if( isset($user['id']) && password_verify($pass, $user['password']) ) {
                // check if the password hash need rehash or not
                if( password_needs_rehash($user['password'], PASSWORD_DEFAULT) ) {
                    DB::update('users', array(
                        'password' => password_hash($pass, PASSWORD_DEFAULT),
                    ), "id=%i", $user['id']);
                }

                // decrypt encryption key for all metafiles
                $key  = hash("sha256", $pass, true);
                $ekey = rtrim(
                    mcrypt_decrypt(
                        MCRYPT_RIJNDAEL_256,
                        $key,
                        hex2bin($user['key_ct']),
                        MCRYPT_MODE_CBC,
                        hex2bin($user['key_iv'])
                    ), "\0..\32");

                // re-encrypt the encryption key
                // ct and iv store in database, key store in client
                $session_ekey_key = mcrypt_create_iv(256/8, MCRYPT_DEV_URANDOM);
                $session_ekey_iv  = mcrypt_create_iv(256/8, MCRYPT_DEV_URANDOM);
                $session_ekey_ct  = bin2hex(
                    mcrypt_encrypt(MCRYPT_RIJNDAEL_256, $session_ekey_key, $ekey, MCRYPT_MODE_CBC, $session_ekey_iv)
                    );

                // create user session
                $time         = time() + $_CONF['cookie_time'];
                $cookie_key   = substr(md5($time * $user['id']), 0, 15);
                $cookie_value = md5($time + mt_rand());
                $ajax_token   = substr(md5($cookie_key . $cookie_value), 0, 15);

                DB::query(
                    "INSERT INTO `sessions` (`key`, `value`, `uid`, `ajax_token`, `key_ct`, `key_iv`, `time`) VALUES (%s, %s, %i, %s, %s, %s, %i)",
                    $cookie_key,
                    $cookie_value,
                    $user['id'],
                    $ajax_token,
                    $session_ekey_ct,
                    bin2hex($session_ekey_iv),
                    $time
                    );

                // write encrypted cookies
                $key = hex2bin(md5($_CONF['cookie_aes_key']));
                $iv  = mcrypt_create_iv(128/8, MCRYPT_DEV_URANDOM);

                $session_info   = $user['id'] . '|' . $cookie_key;
                $encrypted_info = bin2hex(mcrypt_encrypt(MCRYPT_RIJNDAEL_128, $key, $session_info, MCRYPT_MODE_CBC, $iv));

                setcookie($_CONF['cookie_prefix'], $encrypted_info, $time, "/");
                setcookie($_CONF['cookie_prefix'] . '_iv', bin2hex($iv), $time, "/");
                setcookie($_CONF['cookie_prefix'] . '_ekey', bin2hex($session_ekey_key), $time, "/");
                setcookie($cookie_key, $cookie_value, $time, "/");

                // remove AES key
                unset($_SESSION['auth_aes_key']);

                return AUTH_SUCCESS;
            } else {

                // user input wrong credentials
                return AUTH_WRONG_CREDENTIALS;
            }
        }

        // there are three possible cases to reach here:
        //  1. user is already signed in
        //  2. request json is not decodable
        return REGISTER_REFRESH_SESSION;
    }


    /*
     * Sign out
     *
     * @return boolean
     */
    public function signOut() {
        global $_CONF;
        
        if( $this->valid() ) {
            // remove cookies
            setcookie($_CONF['cookie_prefix'], false);
            setcookie($_CONF['cookie_prefix'] . '_iv', false);
            setcookie($_CONF['cookie_prefix'] . '_ekey', false);
            setcookie($this->session_key, false);

            // remove session entry
            DB::delete('sessions', "`key` = %s AND `uid` = %i", $this->session_key, $this->uid);

            return true;
        }

        // either user is not signed in or token is not correct
        return false;
    }


    /*
     * Verify the ajax token
     *
     * @param string token
     * @return boolean
     */
    public function ajaxValid($request_token) {
        return ($this->ajax_token == $request_token);
    }


    /*
     * Cookie getter
     *
     * @return string
     */
    private function getCookie($name) {
        return (isset($_COOKIE[$name]) ? $_COOKIE[$name] : NULL);
    }
}
