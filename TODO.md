# The Stack

The visualizer has 3 different visualizations HUD, Isometric Mapping, and Forces visualization. THe idea is that all of these visualizations should be able to use live telemetry from the basestation.

The basestation acts as a bridge simplifying and annotating images and telemetry from the ASV and sends them as json to the visualizer. The visualizer can then use that to render the visualizations.

LoonE uses SLAM_TOOLbox's /map (nav_msgs/msg/OccupancyGrid) topic to get the global map of the environment. The visualizer can then use that to render the isometric mapping visualization, and the technical and tactical maps in the HUD. The visualizer can also use the /odom topic to get the position of the ASV in the global map, and use that to render the ASV's position in the isometric mapping visualization, and the technical and tactical maps in the HUD.

THe isometric mapping needs to be able to show the map it renders (like rviz but isometric) and the ASV's position in that map. The HUD needs to be able to show the technical and tactical maps, and the ASV's position in those maps. The forces visualization needs to be able to show the forces acting on the ASV, and the ASV's position in that visualization.

We need the tactical, minimap, technical map all to show the objects the zed camera sees. The zed camera is a stereo camera that can detect objects in the environment and send them to the basestation. The basestation can then send those objects to the visualizer, which can then render them in the visualizations.

>[!IMPORTANT] It once used ros2_control and nav2 but we removed that due to time constrants and team technical knowledge.

## Topics from the ASV

- /scan
- /map
- /battery_status/main
- /battery_status/prop_l
- /battery_status/prop_r
- /motor
- /navsatfix
- /phone
- /rosout
- /task

>[!NOTE] prop_l and prop_r share a battery. and both messages should be the same.

## ONNX MODEL TAGS

Model detects only bouys with the exception of "otter" which is a boat

### Labels

- green
- red
- north
- east
- south
- west
- otter

## BOUY information

| Part | Diameter | Height |
| -- | -- | -- |
| Buoy | 40 cm | 40 cm (20 cm above waterline) |
| Cylindrical mark | 14 cm | 40 cm |

## The data to be provided in the GUI are as follows

- Camera feed
- Latitude
- Longitude
- Heading
- Course over ground (COG) with trail,  vs plot of ideal route given by GNSS points to compare.
- Speed over ground.
- Battery life in % left
- Status Indicator: Displays whether the ASV is in autonomous mode, remote control, standby, or out of control.

## TODO

right now we need to ensure the above philsophy and requirements are implemented in our stack.

The idea was to use the factory as a way to test the visualizer and the ASV.
there are two factories. One in the visualizer, and one in the basestation. The visualizer factory is used to test the visualizer, and the basestation factory is used to test the visualizer to basestation bridge. The visualizer factory can be used to test the visualizer without the ASV, and the basestation factory is supposed to be used to test the basestation without the ASV; but I'm not sure it works as expected.

right now when running both humberasv's visualizer (HUD only) (under /connect) and the basestation on factory mode there are the following problems:

- minimap is not showing the objects the zed camera sees. The minimap should show the objects the zed camera sees, and the technical map should show the objects the zed camera sees. The tactical map should show the objects the zed camera sees.
- lat and lang set to 0
- no line showing trail and COG on tactical map
- looks like shite in mobile due to either weird breakpoints or poor responsive design. The visualizer should be responsive and look good on mobile, tablet, and desktop.

right now when running just humberasv's visualizer (under /connect) and the basestation on factory mode there are the following problems:

- minimap is not showing the objects the zed camera sees. The minimap should show the objects the zed camera sees, and the technical map should show the objects the zed camera sees. The tactical map should show the objects the zed camera sees.
- no line showing trail and COG on tactical map
- looks like shite in mobile due to either weird breakpoints or poor responsive design. The visualizer should be responsive and look good on mobile, tablet, and desktop.



right now when running both humberasv's visualizer (under /vehicle/software) and the basestation on factory mode there are the following problems:

- no course trail
- fog of war is bugged and appears to be showing at random places.
- localgrid acting strange
- global grid acting strange
