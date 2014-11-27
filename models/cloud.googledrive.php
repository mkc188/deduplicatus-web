<?php

class GoogleDrive implements CloudStorage {
    private $vault;
    private $client;
    private $services;

    /*
     * Constructor
     */
    public function __construct() {
        global $_CONF;

        $client = new Google_Client();
        $client->setClientId($_CONF['cloud']['googledrive']['credentials']['client']);
        $client->setClientSecret($_CONF['cloud']['googledrive']['credentials']['secret']);
        $client->setRedirectUri($_CONF['cloud']['googledrive']['redirectUri']);
        $client->setAccessType('offline');
        $client->setScopes($_CONF['cloud']['googledrive']['scopes']);

        $this->client = $client;
    }

    public function createAuthUrl($vaultId) {
        global $_CONF;

        $authorizeUrl = $this->client->createAuthUrl();

        $this->vault = $vaultId;
        $_SESSION['oauth_vault'] = $this->vault;
        return $authorizeUrl;
    }

    public function oauthCallback() {
        $this->vault = ( !empty($_SESSION['oauth_vault']) ) ? $_SESSION['oauth_vault'] : '';

        $accessToken = $this->client->authenticate($_GET['code']);
        $json        = json_decode($accessToken);

        $response = array(
            'success'      => false,
            'vault'        => $this->vault,
            'type'         => 'googledrive',
            'error_msg'    => '',
            'access_token' => '',
            'email'        => '',
            'name'         => '',
            'quota'        => 0,
            );

        if( !empty($json->access_token) ) {
            $this->client->setAccessToken($accessToken);

            $this->services = new Google_Service_Drive($this->client);
            $about = $this->services->about->get();
            $response = array(
                'success'      => true,
                'vault'        => $this->vault,
                'type'         => 'googledrive',
                'error_msg'    => '',
                'access_token' => $accessToken,
                'email'        => $about->user->emailAddress,
                'name'         => $about->name,
                'quota'        => intval($about->quotaBytesTotal),
                );
        }

        return $response;
    }

}
