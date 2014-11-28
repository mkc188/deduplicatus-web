<?php

$tpl = $mustache->loadTemplate('index');
$val = array(
    'aes-key' => $auth->getAESKey()
);

// render page with system wise value
echo $tpl->render(array_merge($global_val, $val));
