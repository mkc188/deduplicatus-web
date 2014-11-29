<?php
require_once('environment.php');
require_once('common.php');
require_once('models/class.metafile.php');
/*
require_once('models/interface.cloudstorage.php');
require_once('models/cloud.drive.php');
require_once('models/cloud.dropbox.php');
*/
require_once('models/interface.vaultfs.php');
require_once('models/class.vault.php');
require_once('models/class.spacesaving.php');


//$a = Vault::create('testing', 'space-saving');
//var_dump($a);

$b = Metafile::load('f693dbe9-7ca2-4310-abb7-fba7b74204c9');
var_dump($b);
var_dump(json_decode($b->getContent()));


/*
object(stdClass)#8 (6) {
  ["vault"]=>
  string(36) "1b1fc511-57b0-4d0f-9fbc-7393ab7ae076"
  ["mode"]=>
  int(1)
  ["finalized"]=>
  bool(false)
  ["usedSpace"]=>
  int(0)
  ["totalSpace"]=>
  int(0)
  ["clouds"]=>
  array(2) {
    [0]=>
    object(stdClass)#10 (6) {
      ["identifier"]=>
      string(36) "4a754f16-a2ed-456e-89e6-bbe9fdf56877"
      ["type"]=>
      string(11) "googledrive"
      ["name"]=>
      string(9) "Peter Lam"
      ["email"]=>
      string(17) "lch2003@gmail.com"
      ["quota"]=>
      string(11) "69793218560"
      ["access_token"]=>
      string(1112) "{"access_token":"ya29.xgB63woXrhG6REs7KRx37_aukvyi1h7YsjWsUwlR6FpkU-hWNenZJ6zUKaQg8jovK3a_gjI5P4fIFg","token_type":"Bearer","expires_in":3599,"id_token":"eyJhbGciOiJSUzI1NiIsImtpZCI6IjU1YjJiMjgwMTM5ODMyMzAzZGEwZWU4ZTJiMDRiMWQyYzA4NWVlMmEifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiaWQiOiIxMDY0MDkwNTQ0ODgxMDk3Nzc1MzciLCJzdWIiOiIxMDY0MDkwNTQ0ODgxMDk3Nzc1MzciLCJhenAiOiIyMDY0NjkzNDYxOC1xYzhzZW40ODI0b3F2MXZocHZhNWNkcGFvbmIwYmkwbC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsImVtYWlsIjoibGNoMjAwM0BnbWFpbC5jb20iLCJhdF9oYXNoIjoiQVJhWUxybmo0MGl4OS1qRi14OTMxUSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdWQiOiIyMDY0NjkzNDYxOC1xYzhzZW40ODI0b3F2MXZocHZhNWNkcGFvbmIwYmkwbC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsInRva2VuX2hhc2giOiJBUmFZTHJuajQwaXg5LWpGLXg5MzFRIiwidmVyaWZpZWRfZW1haWwiOnRydWUsImNpZCI6IjIwNjQ2OTM0NjE4LXFjOHNlbjQ4MjRvcXYxdmhwdmE1Y2RwYW9uYjBiaTBsLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiaWF0IjoxNDE2NjYzNDc2LCJleHAiOjE0MTY2NjczNzZ9.TJHkItOsORAoJ8Fkv7heIJID-1GkEyqDNSEIXh3dQpRTKQh5WdL-BX7U12Hz8fr2yDa9XfaDvhmamg3YZK6PUd8Qk6siLzMacmCFOccDbm3KSlo4uDZ1K6QTU5Sn7nIud4dqkKg106UyrNDfVQ8Xc9dgpvo5yrl82UfBOPLcNFM","created":1416663775}"
    }
    [1]=>
    object(stdClass)#9 (6) {
      ["identifier"]=>
      string(36) "10899da9-a6d9-4c16-af87-0057bdcbbac3"
      ["type"]=>
      string(7) "dropbox"
      ["name"]=>
      string(9) "Peter Lam"
      ["email"]=>
      string(17) "lch2003@gmail.com"
      ["quota"]=>
      int(101871255552)
      ["access_token"]=>
      string(64) "76QRVz8YhYIAAAAAAAB1aDB-Jz1i6jcaDJ8Zwc7048wF-6bZm41eGqug7OkLvKE9"
    }
  }
}

*/