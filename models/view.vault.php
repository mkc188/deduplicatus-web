<?php

// follow the $_parts to determine the action
$action = ( !empty($_parts[1]) ) ? $_parts[1] : '';

if( $action == "list" ) {
    $raw_data = file_get_contents('php://input');

    // load required classes
    require_once('models/class.metafile.php');
    require_once('models/class.vaultlist.php');
    $response = new VaultList();

    header('Content-type: application/json');
    echo json_encode($response->get());
    exit();
}

if( $action == "listCloud" ) {
    $raw_data = file_get_contents('php://input');

    // load required classes
    require_once('models/class.metafile.php');
    require_once('models/class.vaultlist.php');
    $response   = new VaultList();
    $request_id = $_parts[2];

    header('Content-type: application/json');
    echo json_encode($response->getClouds($request_id));
    exit();
}

if( $action == "removeCloud" ) {
    $raw_data   = file_get_contents('php://input');
    $request_id = $_parts[2];

    // load required classes
    require_once('models/class.metafile.php');
    require_once('models/class.vault.php');

    $json = json_decode($raw_data);
    $isJSONValid = ( json_last_error() == JSON_ERROR_NONE );

    if( $isJSONValid &&
        !empty($json->ajax_token) &&
        $auth->ajaxValid($json->ajax_token) ) {

        $vault = Vault::load($request_id);
        if( !empty($vault) ) {
            $vault->removeCloudCredential($json->identifier);

            $response = array('success' => true);   
        } else {
            $response = array('success' => false);   
        }
    } else {
        $response = array('success' => false);   
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}

if( $action == "finalize" ) {
    $raw_data = file_get_contents('php://input');
    $request_id = $_parts[2];

    // load required classes
    require_once('models/class.metafile.php');
    require_once('models/class.vault.php');

    $json = json_decode($raw_data);
    $isJSONValid = ( json_last_error() == JSON_ERROR_NONE );

    if( $isJSONValid &&
        !empty($json->ajax_token) &&
        $auth->ajaxValid($json->ajax_token) ) {

        $vault = Vault::load($request_id);
        if( !empty($vault) ) {
            $vault->finalize();

            $response = array('success' => true);   
        } else {
            $response = array('success' => false);   
        }
    } else {
        $response = array('success' => false);   
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}

if( $action == "new" ) {
    $raw_data = file_get_contents('php://input');

    // load required classes
    require_once('models/class.metafile.php');
    require_once('models/class.vault.php');

    $json = json_decode($raw_data);
    $isJSONValid = ( json_last_error() == JSON_ERROR_NONE );

    if( $isJSONValid &&
        !empty($json->ajax_token) &&
        $auth->ajaxValid($json->ajax_token) ) {
        if( empty($json->name) ) {
            $error_code = VAULT_NAME_EMPTY;
        } else {
            $name_count = DB::queryOneField('name_count', "SELECT COUNT(id) as name_count FROM `vaults` WHERE `name` = %s", $json->name);

            if( !intval($name_count) ) {
                $vault = Vault::create($json->name, $json->mode);
                if( empty($vault->getId()) ) {
                    $error_code = VAULT_UNKNOWN_ERR;
                } else {
                    $error_code = VAULT_SUCCESS;
                }

            } else {
                $error_code = VAULT_NAME_EXISTS;
            } 
        }
    } else {
        $error_code = VAULT_UNKNOWN_ERR;
    }

    switch ($error_code) {
        case VAULT_SUCCESS:
            $response = array(
                'success'  => true,
                'vault_id' => $vault->getId(),
                );
            break;
        
        case VAULT_NAME_EMPTY:
            $response = array(
                'success'   => false,
                'error_msg' => 'Please enter vault name.',
                );
            break;

        case VAULT_NAME_EXISTS:
            $response = array(
                'success'   => false,
                'error_msg' => 'Vault name already used.',
                );
            break;

        case VAULT_UNKNOWN_ERR:
        default:
            $response = array(
                'success'   => false,
                'error_msg' => 'Unknown error. Please refresh.',
                );
            break;
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}

if( $action == "pre-oauth" ) {
    $raw_data   = file_get_contents('php://input');
    $request_id = $_parts[2];

    $json = json_decode($raw_data);
    $isJSONValid = ( json_last_error() == JSON_ERROR_NONE );

    if( $isJSONValid &&
        !empty($json->ajax_token) &&
        $auth->ajaxValid($json->ajax_token) ) {

        // load required classes
        require_once('models/class.metafile.php');
        require_once('models/class.vault.php');
        require_once('models/interface.cloudstorage.php');

        $vault = Vault::load($request_id);
        if( !empty($vault) ) {

            if( !$vault->isFinalized() ) {
                if( array_key_exists($json->cloud, $_storageProviderClass) ) {
                    require_once('models/cloud.' . $json->cloud . '.php');

                    $cloud = new $_storageProviderClass[$json->cloud]($vault);
                    $oauth = $cloud->createAuthUrl($vault->getId());

                    $error_code = VAULT_SUCCESS;
                } else {
                    $error_code = VAULT_UNKNOWN_ERR;
                }
            } else {
                $error_code = VAULT_ALREADY_FINALIZED;
            }
        } else {
            $error_code = VAULT_NOT_FOUND;
        }
    } else {
        $error_code = VAULT_UNKNOWN_ERR;
    }

    switch ($error_code) {
        case VAULT_SUCCESS:
            $response = array(
                'success'  => true,
                'oauth'    => $oauth,
                );
            break;
        
        case VAULT_ALREADY_FINALIZED:
            $response = array(
                'success'   => false,
                'error_msg' => 'Vault alreay finalized.',
                );
            break;

        case VAULT_NOT_FOUND:
            $response = array(
                'success'   => false,
                'error_msg' => 'Vault not found.',
                );
            break;

        case VAULT_UNKNOWN_ERR:
        default:
            $response = array(
                'success'   => false,
                'error_msg' => 'Unknown error. Please refresh.',
                );
            break;
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}

if( $action == "post-oauth" ) {
    $callbackProvider = $_parts[2];

    // load required classes
    require_once('models/class.metafile.php');
    require_once('models/class.vault.php');
    require_once('models/interface.cloudstorage.php');
    if( array_key_exists($callbackProvider, $_storageProviderClass) ) {
        require_once('models/cloud.' . $callbackProvider . '.php');

        $cloud = new $_storageProviderClass[$callbackProvider]();
        $oauth = $cloud->oauthCallback();

        if( !empty($oauth['vault']) ) {
            $vault = Vault::load($oauth['vault']);
        }

        if( !empty($oauth['success']) ) {
            if( !empty($vault) ) {
                $vault->addCloudCredential($oauth);

                // done adding cloud to vault, redirect back to vault page
                header("Location: " . APP_PATH . "vault/" . $oauth['vault']);
            } else {
                // error case: vault not found
                header("Location: " . APP_PATH . "dashboard/");
            }
        } else {
            if( !empty($vault) ) {
                // error case: oauth failed
                header("Location: " . APP_PATH . "vault/" . $oauth['vault'] . "?err=1");

            } else {
                // error case: oauth failed and vault not found
                header("Location: " . APP_PATH . "dashboard/");
            }
        }
    }

    exit();
}

// for other vault operations, process its vault id first
$request_id = $_parts[1];

// load required classes
require_once('models/class.metafile.php');
require_once('models/class.vault.php');

$vault = Vault::load($request_id);
if( !empty($vault) ) {

    if( !$vault->isFinalized() ) {
        // vault not exists or the owner of vault is not the current user
        $tpl = $mustache->loadTemplate('vault_addcloud');
        $val = array(
            'vault-id'   => $vault->getId(),
            'vault-name' => $vault->getName(),
            'is-'.$vault->getMode() => true,
            );

        if( !empty($_GET['err']) ) {
            $val['previous-err'] = "OAuth Error";
        }

        echo $tpl->render(array_merge($global_val, $val));

    } else {
        // vault not exists or the owner of vault is not the current user
        $tpl = $mustache->loadTemplate('vault_info');
        $val = array(
            'vault-id'   => $vault->getId(),
            'vault-name' => $vault->getName(),
            'is-'.$vault->getMode() => true,
            );

        echo $tpl->render(array_merge($global_val, $val));
    }

} else {
    // vault not exists or the owner of vault is not the current user
    $tpl = $mustache->loadTemplate('http_404');
    echo $tpl->render();
}
