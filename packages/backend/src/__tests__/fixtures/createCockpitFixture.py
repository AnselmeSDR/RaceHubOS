"""Synthetic public test fixture; never reads the user's Cockpit-XP files."""
import sqlite3, tempfile, zipfile, pathlib, sys, base64

def create(target):
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        db = sqlite3.connect(root / 'stamm')
        db.executescript("""
CREATE TABLE DriverItems(ID INTEGER, Driver TEXT, FullName TEXT, Activ INTEGER, Picture TEXT);
CREATE TABLE CarItems(ID INTEGER, Car TEXT, FullName TEXT, Activ INTEGER, Picture TEXT, XMLData TEXT, ServiceWerte TEXT, ServiceAktiv INTEGER);
CREATE TABLE CourseItems(ID INTEGER, Course TEXT, FullName TEXT, Activ INTEGER, Picture TEXT);
CREATE TABLE CarData(CarName TEXT, Property TEXT, Value TEXT);
INSERT INTO DriverItems VALUES(1,'Fixture Driver','Fixture Driver',1,'driver.png');
INSERT INTO DriverItems VALUES(2,'Inactive Driver','Inactive Driver',0,NULL);
INSERT INTO CarItems VALUES(3,'Fixture Car','Fixture Car',1,'car.png','<Data><MoreInfo>Synthetic example</MoreInfo><ImEinsatzSeit>2023-01-01</ImEinsatzSeit></Data>','<Data><ServiceIntervalle Runden="1000" RundenService="123"/></Data>',1);
INSERT INTO CourseItems VALUES(4,'Fixture Track','Fixture Track',1,NULL);
INSERT INTO CarData VALUES('Fixture Car','Motor','Fixture motor');
INSERT INTO CarData VALUES('Fixture Car','Ritzel','9');
INSERT INTO CarData VALUES('Fixture Car','Zahnrad','27');
""")
        db.commit(); db.close()
        db = sqlite3.connect(root / 'statistik')
        db.executescript("""
CREATE TABLE StRennResults(ID INTEGER, Fahrer TEXT, Fahrzeug TEXT, RennStrecke TEXT, Runden INTEGER, Gesamtzeit INTEGER, BesteRunde INTEGER, Platz INTEGER, Datum TEXT);
INSERT INTO StRennResults VALUES(1,'Fixture Driver','Fixture Car','Fixture Track',5,36000,7000,1,'20230101');
INSERT INTO StRennResults VALUES(2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
CREATE TABLE StRoundTime(ID INTEGER, Driver TEXT, Car TEXT, Course TEXT, RoundTime INTEGER);
INSERT INTO StRoundTime VALUES(3,'Fixture Driver','Fixture Car','Fixture Track',7123);
""")
        db.commit(); db.close()
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=')
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.write(root/'stamm','Database.sqlite/cpv2stamm')
            archive.write(root/'statistik','Database.sqlite/cpv2statistik')
            archive.writestr('Bilder/driver.png',png)
            archive.writestr('Bilder/car.png',png)
            archive.writestr('AddOns/do-not-run.py','raise RuntimeError("must never execute")')
            archive.writestr('../do-not-extract.txt','must never extract')
if __name__ == '__main__':
    create(sys.argv[1])
