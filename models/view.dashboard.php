<?php

$tpl = $mustache->loadTemplate('dashboard');
$val = array(
);

// render page with system wise value
echo $tpl->render(array_merge($global_val, $val));
