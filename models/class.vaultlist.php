<?php

class VaultList {
    public function get() {
        global $auth, $_storageMode, $_storageProvider;

        $vaults = array();
        if( $auth->valid() ) {
            $results = DB::query("SELECT * FROM vaults WHERE owner=%d", $auth->uid);

            foreach ($results as $row) {
                // obtain the summary metafile
                $credentialStr  = Metafile::load($row['credentials']);
                $credentialData = json_decode($credentialStr->getContent());

                // determine the storage mode used
                $mode = 'unknown';
                foreach ($_storageMode as $key => $value) {
                    if( $credentialData->mode == $value ) {
                        $mode = $key;
                        break;
                    }
                }

                // obtain all clouds information
                $clouds = array();
                foreach ($credentialData->clouds as $value) {
                    $clouds[] = array(
                        'identifier'   => $value->identifier,
                        'type'         => $value->type,
                        'name'         => $value->name,
                        'email'        => $value->email,
                        'quota'        => $value->quota,
                        );
                }

                $vaults[] = array(
                    'id'         => $row['id'],
                    'name'       => $row['name'],
                    'mode'       => $mode,
                    'clouds'     => $clouds,
                    'usedSpace'  => $credentialData->usedSpace,
                    'totalSpace' => $credentialData->totalSpace,
                    'finalized'  => $credentialData->finalized,
                    );
            }
        }

        return $vaults;
    }

    public function getClouds($vaultId) {
        global $auth, $_storageMode, $_storageProvider;

        $array = array();
        $vault = DB::queryFirstRow("SELECT * FROM vaults WHERE id=%s AND owner=%d", $vaultId, $auth->uid);

        if( !empty($vaultId) && $vault['id'] == $vaultId ) {
            // obtain the credentials metafile
            $credentialStr  = Metafile::load($vault['credentials']);
            $credentialData = json_decode($credentialStr->getContent());

            foreach ($credentialData->clouds as $value) {
                $array[] = array(
                    'identifier'   => $value->identifier,
                    'type'         => $value->type,
                    'name'         => $value->name,
                    'email'        => $value->email,
                    'quota'        => $value->quota,
                    );
            }
        }

        return $array;
    }

}
