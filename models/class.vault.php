<?php

class Vault {
    private $id;
    private $owner;
    private $name;
    private $credentialId;
    private $credentialObj;
    private $credentialRef;
    private $fsRootId;
    private $fsRootObj = false;
    private $fsRootRef;

    /*
     * Create new vault and store in database
     *
     * @param string name
     * @param string mode
     * @return Vault
     */
    public function create($name, $mode) {
        global $auth, $_storageMode;

        // reject to create vault if:
        // - not authorized user
        // - incorrect mode
        // - empty vault name
        if( $auth->uid == 0 || empty($name) || !array_key_exists($mode, $_storageMode) ) {
            return false;
        }

        $instance = new self();
        $instance->id = Rhumsaa\Uuid\Uuid::uuid4()->toString();
        $instance->owner = $auth->uid;

        // prepare two default metafiles
        $instance->credentialObj = array(
            'vault'      => $instance->id,
            'mode'       => $_storageMode[$mode],
            'finalized'  => false,
            'usedSpace'  => 0,
            'totalSpace' => 0,
            'clouds'     => array(),
            );
        $instance->fsRootObj = array(
            'vault'    => $instance->id,
            'isRoot'   => true,
            'name'     => '',
            'path'     => '/',
            'content'  => array(),
            );

        // save metadata and obtain their id
        $instance->credentialRef = Metafile::create( json_encode($instance->credentialObj) );
        $instance->fsRootRef     = Metafile::create( json_encode($instance->fsRootObj) );

        $instance->credentialId = $instance->credentialRef->getId();
        $instance->fsRootId     = $instance->fsRootRef->getId();

        // insert record into database
        DB::insert('vaults', array(
            'id'          => $instance->id,
            'owner'       => $auth->uid,
            'name'        => $name,
            'credentials' => $instance->credentialId,
            'fs_root'     => $instance->fsRootId,
            ));

        return $instance;
    }


    /*
     * Load existing vault and read its summary
     *
     * @param string id
     * @return Vault
     */
    public function load($id) {
        global $auth;
        $vault = DB::queryFirstRow("SELECT * FROM vaults WHERE id=%s AND owner=%d", $id, $auth->uid);

        if( !empty($id) && $vault['id'] == $id ) {
            $instance = new self();

            $instance->id           = $vault['id'];
            $instance->owner        = $vault['owner'];
            $instance->name         = $vault['name'];
            $instance->credentialId = $vault['credentials'];
            $instance->fsRootId     = $vault['fs_root'];

            $instance->credentialRef = Metafile::load($instance->credentialId);
            $instance->credentialObj = json_decode($instance->credentialRef->getContent());

            return $instance;
        }

        return false;
    }


    /*
     * Getter for vault id
     *
     * @return string id
     */
    public function getId() {
        return ( !empty($this->id) ) ? $this->id : '';
    }


    /*
     * Getter for vault name
     *
     * @return string name
     */
    public function getName() {
        return ( !empty($this->id) ) ? $this->name : '';
    }


    /*
     * Getter for vault mode
     *
     * @return string mode
     */
    public function getMode() {
        global $_storageMode;

        $mode = 'unknown';
        if( !empty($this->id) ) {
            foreach ($_storageMode as $key => $value) {
                if( $this->credentialObj->mode == $value ) {
                    $mode = $key;
                    break;
                }
            }
        }

        return $mode;
    }


    /*
     * Return the vault is finalized or not
     */
    public function isFinalized() {
        return ( !empty($this->id) ) ? $this->credentialObj->finalized : '';
    }


    /*
     * Obtain credential metafile if not in instance
     */
    private function fetchFsRoot() {
        if( !empty($this->fsRootId) && empty($this->fsRootObj) ) {
            $this->fsRootRef = Metafile::load($this->fsRootId);
            $this->fsRootObj = json_decode($instance->fsRootRef->getContent());
        }
    }


    public function addCloudCredential($arr) {
        if( !empty($this->id) ) {
            $sameCloud = false;
            foreach ($this->credentialObj->clouds as $value) {
                if( $value->email == $arr['email'] &&
                    $value->type == $arr['type'] ) {
                    $sameCloud = true;
                }
            }

            if( !$sameCloud ) {
                $this->credentialObj->clouds[] = array(
                    'identifier'   => Rhumsaa\Uuid\Uuid::uuid4()->toString(),
                    'type'         => $arr['type'],
                    'name'         => $arr['name'],
                    'email'        => $arr['email'],
                    'quota'        => $arr['quota'],
                    'access_token' => $arr['access_token'],
                    );
            }

            $this->credentialRef->set( json_encode($this->credentialObj) );
        }
    }


    public function removeCloudCredential($identifier) {
        if( !empty($this->id) ) {
            $newCloudArr = array();

            foreach ($this->credentialObj->clouds as $value) {
                if( $value->identifier != $identifier ) {
                    $newCloudArr[] = $value;
                }
            }
            $this->credentialObj->clouds = $newCloudArr;
            $this->credentialRef->set( json_encode($this->credentialObj) );
        }
    }

    /*
     * For Demo only:
     *   the following methods are Space Saving mode
     *   other modes should be implemented in their own classes
     */
    public function updateAccessToken($cloud_identifier, $access_token) {
        if( !empty($this->id) ) {
            $newCloudArr = array();

            foreach ($this->credentialObj->clouds as $value) {
                if( $value->identifier == $cloud_identifier ) {
                    $value->access_token = $access_token;
                }

                $newCloudArr[] = $value;
            }
            $this->credentialObj->clouds = $newCloudArr;
            $this->credentialRef->set( json_encode($this->credentialObj) );
        }
    }

    public function finalize() {
        if( !empty($this->id) ) {
            if( count($this->credentialObj->clouds) >= 1 ) {
                $totalSpace = 0;

                foreach ($this->credentialObj->clouds as $value) {
                    $totalSpace += $value->quota;
                }
                $this->credentialObj->totalSpace = $totalSpace;
                $this->credentialObj->finalized  = true;
                $this->credentialRef->set( json_encode($this->credentialObj) );

                return true;
            }
        }

        return false;
    }

    public function listFile($path = '/', $cloudId = false) {
        global $_storageProviderClass;

        $response = array();

        if( !empty($this->id) ) {
            foreach ($this->credentialObj->clouds as $value) {
                if( $path == '/' || ( $path != '/' && $cloud == $value->identifier ) ) {
                    $cloudProvider = $value->type;
                    if( array_key_exists($cloudProvider, $_storageProviderClass) ) {
                        require_once('models/cloud.' . $cloudProvider . '.php');

                        $cloud = new $_storageProviderClass[$cloudProvider]($this, $value->identifier);
                        $cloud->loadAccessToken($value->access_token);

                        $response = array_merge($response, $cloud->listFile($path));
                    }
                }
            }
        }

        return $response;
    }

    public function get($path, $cloud = false) {
        if( !empty($this->id) ) {




        } else {
            return array();
        }
    }

    public function upload($path, $size, $cloud = false) {
        if( !empty($this->id) ) {




        } else {
            return array();
        }
    }
}
