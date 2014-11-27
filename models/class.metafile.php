<?php

class Metafile {
    private $id;
    private $key;
    private $iv;
    private $ct;
    private $cx;

    /*
     * Constructor
     */
    public function __construct() {
        global $auth;
        $this->key = hex2bin($auth->getEncryptionKey());
    }


    /*
     * Create new metafile in database and return the object
     *
     * @param string content
     * @param bool autosave
     * @return Metafile
     */
    public function create($content, $autosave = true) {
        global $auth;

        // check signin state and content
        if( !$auth->valid() || !Metafile::validJson($content) ) {
            return false;
        }

        $instance = new self();

        // generate metefile ID and IV
        $instance->id = Rhumsaa\Uuid\Uuid::uuid4()->toString();
        $instance->iv = mcrypt_create_iv(256/8, MCRYPT_DEV_URANDOM);

        // encrypt the content and store it internally
        $instance->cx = $content;
        $instance->ct = mcrypt_encrypt(MCRYPT_RIJNDAEL_256, $instance->key, $instance->cx, MCRYPT_MODE_CBC, $instance->iv);

        if( $autosave ) {
            $instance->save(true);
        }

        return $instance;
    }


    /*
     * Load existing metafile
     *
     * @param string id
     * @return Metafile
     */
    public function load($id) {
        $metafile = DB::queryFirstRow("SELECT * FROM metafiles WHERE id=%s", $id);

        if( $metafile['id'] == $id ) {
            $instance = new self();

            $instance->iv = hex2bin($metafile['iv']);
            $instance->ct = hex2bin($metafile['ct']);
            $instance->cx = rtrim(
                mcrypt_decrypt(
                    MCRYPT_RIJNDAEL_256,
                    $instance->key,
                    $instance->ct,
                    MCRYPT_MODE_CBC,
                    $instance->iv
                ), "\0..\32");

            if( Metafile::validJson($instance->cx) ) {
                $instance->id = $id;
                return $instance;
            }
        }

        return false;
    }


    /*
     * Getter for metafile id
     */
    public function getId() {
        return ( !empty($this->id) ) ? $this->id : '';
    }


    /*
     * Getter for metafile content
     */
    public function getContent() {
        return ( !empty($this->cx) ) ? $this->cx : '';
    }


    /*
     * Set metafile content
     *
     * @param string content
     * @param bool autosave
     */
    public function set($content, $autosave = true) {
        if( empty($this->id) || !$this->validJson($content) ) {
            return false;
        }

        // generate new IV and encrypt the content
        $this->cx = $content;
        $this->iv = mcrypt_create_iv(256/8, MCRYPT_DEV_URANDOM);
        $this->ct = mcrypt_encrypt(MCRYPT_RIJNDAEL_256, $this->key, $this->cx, MCRYPT_MODE_CBC, $this->iv);

        if( $autosave ) {
            $this->save(false);
        }
    }


    /*
     * Commit metafile changes in database
     *
     * @param bool insertOnly use insert query only
     * @return bool success
     */
    public function save($insertOnly) {
        if( empty($this->id) ) {
            return false;
        }

        if( $insertOnly ) {
            DB::insert('metafiles', array(
              'id' => $this->id,
              'ct' => bin2hex($this->ct),
              'iv' => bin2hex($this->iv),
            ));
        } else {
            DB::update('metafiles', array(
              'ct' => bin2hex($this->ct),
              'iv' => bin2hex($this->iv),
            ), "id=%s", $this->id);
        }
        return true;
    }


    /*
     * Test if the content is valid JSON, since all metafile should be a JSON file
     *
     * @return bool
     */
    private function validJson($string) {
        json_decode($string);
        return (json_last_error() == JSON_ERROR_NONE);
    }
}
