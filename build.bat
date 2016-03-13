@ECHO -------------------------------------------
@ECHO             Giles for Gerrit
@ECHO Install Node Packages and build output for
@ECHO publishing extension.
@ECHO -------------------------------------------
#(if exist .\publish RD /s /q .\publish) && npm install && npm run webpack -- -p && npm run grunt
(if exist .\publish RD /s /q .\publish) && npm install && npm run webpack && npm run grunt
