import xml.etree.ElementTree as ET
path = 'android/app/src/main/AndroidManifest.xml'
tree = ET.parse(path)
root = tree.getroot()
permissions = [
    "android.permission.CAMERA",
    "android.permission.FLASHLIGHT"
]
for p in permissions:
    if not any(elem.attrib.get('{http://schemas.android.com/apk/res/android}name') == p for elem in root.findall('uses-permission')):
        new_p = ET.SubElement(root, 'uses-permission')
        new_p.set('android:name', p)
tree.write(path, encoding='utf-8', xml_declaration=True)
