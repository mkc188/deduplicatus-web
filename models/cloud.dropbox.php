<?php
use \Dropbox as dbx;

class Dropbox implements CloudStorage {
    private $vault;
    private $identifier;
    private $client;
    private $clientName = 'DeDuplicatus/1.0';

    /*
     * Constructor
     */
    public function __construct($vault = NULL, $identifier = '') {
        $this->vault = $vault;
        $this->identifier = $identifier;
    }

    public function loadAccessToken($token) {
        $this->client = new dbx\Client($token, $this->clientName);
    }

    private function getWebAuth() {
        global $_CONF;

        $appInfo        = dbx\AppInfo::loadFromJson($_CONF['cloud']['dropbox']['credentials']);
        $csrfTokenStore = new dbx\ArrayEntryStore($_SESSION, 'dropbox-auth-csrf-token');
        $webAuth        = new dbx\WebAuth($appInfo, $this->clientName, $_CONF['cloud']['dropbox']['redirectUri'], $csrfTokenStore);

        return $webAuth;
    }

    public function createAuthUrl($vaultId) {
        $authorizeUrl = $this->getWebAuth()->start();
        $this->vault  = $vaultId;

        $_SESSION['oauth_vault'] = $this->vault;
        return $authorizeUrl;
    }

    public function oauthCallback() {
        $this->vault = ( !empty($_SESSION['oauth_vault']) ) ? $_SESSION['oauth_vault'] : '';

        $response = array(
            'success'      => false,
            'vault'        => $this->vault,
            'type'         => 'dropbox',
            'error_msg'    => '',
            'access_token' => '',
            'email'        => '',
            'name'         => '',
            'quota'        => 0,
            );

        try {
            list($accessToken, $userId, $urlState) = $this->getWebAuth()->finish($_GET);
            assert($urlState === null);  // Since we didn't pass anything in start()
        }
        catch (dbx\WebAuthException_BadRequest $ex) {
            $response['error_msg'] = 'Dropbox: Bad Request.';
        }
        catch (dbx\WebAuthException_BadState $ex) {
            $response['error_msg'] = 'Dropbox: Please Retry.';
        }
        catch (dbx\WebAuthException_Csrf $ex) {
            $response['error_msg'] = 'Dropbox: CSRF mismatch.';
        }
        catch (dbx\WebAuthException_NotApproved $ex) {
            $response['error_msg'] = 'Dropbox: Not Approved.';
        }
        catch (dbx\Exception $ex) {
            $response['error_msg'] = 'Dropbox: API Error.';
        }

        if( !empty($accessToken) ) {
            $dbxClient   = new dbx\Client($accessToken, $this->clientName);
            $accountInfo = $dbxClient->getAccountInfo();

            $response = array(
                'success'      => true,
                'vault'        => $this->vault,
                'type'         => 'dropbox',
                'error_msg'    => '',
                'access_token' => $accessToken,
                'email'        => $accountInfo['email'],
                'name'         => $accountInfo['display_name'],
                'quota'        => $accountInfo['quota_info']['quota'],
                );
        }

        return $response;
    }

    public function listFile($path = "/") {
        $items = $this->client->getMetadataWithChildren($path);
        $list  = array();

        if( is_array($items["contents"]) ) {
            foreach ($items["contents"] as $value) {
                $list[] = array(
                    'size'      => $value['bytes'],
                    'name'      => basename($value['path']),
                    'path'      => $value['path'],
                    'modified'  => strtotime($value['modified']),
                    'is_folder' => $value['is_dir'],
                    'cloud'     => $this->identifier,
                    );
            }
        }

        return $list;
    }

}