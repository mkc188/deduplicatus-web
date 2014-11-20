<?php

// follow the $_parts to determine the action
$action = ( !empty($_parts[1]) ) ? $_parts[1] : '';

if( $action == "register" ) {
    $raw_data = file_get_contents('php://input');

    // just output what we got from auth class
    switch ($auth->register($raw_data)) {
        case REGISTER_SUCCESS:
            $response = array('success' => true);
            break;

        case REGISTER_USER_EXITS:
            $response = array(
                'success'   => false,
                'error_msg' => 'Username alreay used.'
                );
            break;

        case REGISTER_EMAIL_EXITS:
            $response = array(
                'success'   => false,
                'error_msg' => 'Email address alreay used.'
                );
            break;

        case REGISTER_FIELD_INCOMPLETE:
            $response = array(
                'success'   => false,
                'error_msg' => 'Please fill in all fields.'
                );
            break;

        case REGISTER_REFRESH_SESSION:
        default:
            $response = array(
                'success'   => false,
                'error_msg' => 'Encryption key expired. Please refresh.'
                );
            break;
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}

if( $action == "signin" ) {
    $raw_data = file_get_contents('php://input');

    // just output what we got from auth class
    switch ($auth->signIn($raw_data)) {
        case AUTH_SUCCESS:
            $response = array('success' => true);
            break;

        case AUTH_WRONG_CREDENTIALS:
            $response = array(
                'success'   => false,
                'error_msg' => 'Wrong Credentials.'
                );
            break;

        case AUTH_REFRESH_SESSION:
        default:
            $response = array(
                'success'   => false,
                'error_msg' => 'Encryption key expired. Please refresh.'
                );
            break;
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}

if( $action == "token" ) {
    if( $auth->valid() ) {
        // user signed on
        $response = array(
            'success'    => true,
            'username'   => $auth->username,
            'ajax_token' => $auth->ajax_token,
        );
    } else {
        // user not signed on
        $response = array('success' => false);
    }

    header('Content-type: application/json');
    echo json_encode($response);
    exit();
}

if( $action == "signout" ) {
    $token = ( !empty($_REQUEST['token']) ) ? $_REQUEST['token'] : '';

    header('Content-type: application/json');
    echo json_encode( array('success' => $auth->signOut($token)) );
    exit();
}
